-- Integrity rules that the database itself enforces (PRD §12.3).
-- This file is idempotent: scripts/migrate.ts runs it after every drizzle migration.

-- 1. Every entry is balanced per currency, checked at COMMIT (deferred) ----------------
CREATE OR REPLACE FUNCTION cc_check_entry_balanced() RETURNS trigger AS $$
DECLARE
    bad record;
BEGIN
    SELECT currency, SUM(debit) AS d, SUM(credit) AS c
      INTO bad
      FROM journal_lines
     WHERE entry_id = NEW.entry_id
     GROUP BY currency
    HAVING SUM(debit) <> SUM(credit)
     LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'unbalanced journal entry % in %: debit % <> credit %', NEW.entry_id, bad.currency, bad.d, bad.c
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cc_journal_lines_balanced ON journal_lines;
CREATE CONSTRAINT TRIGGER cc_journal_lines_balanced
    AFTER INSERT ON journal_lines
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION cc_check_entry_balanced();

-- 2. Lines are insert-only ------------------------------------------------------------
CREATE OR REPLACE FUNCTION cc_block_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% on % is not allowed (money records are immutable)', TG_OP, TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cc_journal_lines_immutable ON journal_lines;
CREATE TRIGGER cc_journal_lines_immutable
    BEFORE UPDATE OR DELETE ON journal_lines
    FOR EACH ROW EXECUTE FUNCTION cc_block_change();

DROP TRIGGER IF EXISTS cc_journal_entries_no_delete ON journal_entries;
CREATE TRIGGER cc_journal_entries_no_delete
    BEFORE DELETE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION cc_block_change();

DROP TRIGGER IF EXISTS cc_allocations_immutable ON container_charge_allocations;
CREATE TRIGGER cc_allocations_immutable
    BEFORE UPDATE OR DELETE ON container_charge_allocations
    FOR EACH ROW EXECUTE FUNCTION cc_block_change();

-- 3. On entries only cancelled_at / cancel_reason may change ---------------------------
CREATE OR REPLACE FUNCTION cc_entries_only_cancel() RETURNS trigger AS $$
BEGIN
    IF (to_jsonb(NEW) - 'cancelled_at' - 'cancel_reason') IS DISTINCT FROM (to_jsonb(OLD) - 'cancelled_at' - 'cancel_reason') THEN
        RAISE EXCEPTION 'journal entries can only be cancelled, not edited' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cc_journal_entries_only_cancel ON journal_entries;
CREATE TRIGGER cc_journal_entries_only_cancel
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION cc_entries_only_cancel();

-- 4. A line's currency equals its account's currency -----------------------------------
CREATE OR REPLACE FUNCTION cc_line_currency_matches() RETURNS trigger AS $$
DECLARE
    acc_currency currency;
BEGIN
    SELECT a.currency INTO acc_currency FROM accounts a WHERE a.id = NEW.account_id;
    IF acc_currency IS DISTINCT FROM NEW.currency THEN
        RAISE EXCEPTION 'line currency % does not match account currency %', NEW.currency, acc_currency
            USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.debit < 0 OR NEW.credit < 0 OR (NEW.debit <> 0 AND NEW.credit <> 0) OR (NEW.debit = 0 AND NEW.credit = 0) THEN
        RAISE EXCEPTION 'a line needs exactly one positive side' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cc_journal_lines_currency ON journal_lines;
CREATE TRIGGER cc_journal_lines_currency
    BEFORE INSERT ON journal_lines
    FOR EACH ROW EXECUTE FUNCTION cc_line_currency_matches();

-- 5. A vault account only exists for a currency the vault accepts ----------------------
CREATE OR REPLACE FUNCTION cc_vault_account_currency() RETURNS trigger AS $$
BEGIN
    IF NEW.kind = 'vault' AND NOT EXISTS (
        SELECT 1 FROM vaults v WHERE v.id = NEW.ref_id AND NEW.currency = ANY (v.allowed_currencies)
    ) THEN
        RAISE EXCEPTION 'vault % does not accept %', NEW.ref_id, NEW.currency USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cc_accounts_vault_currency ON accounts;
CREATE TRIGGER cc_accounts_vault_currency
    BEFORE INSERT ON accounts
    FOR EACH ROW EXECUTE FUNCTION cc_vault_account_currency();

-- 6. Views ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW account_balances AS
SELECT a.id AS account_id, a.kind, a.ref_id, a.currency,
       COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS balance
  FROM accounts a
  LEFT JOIN journal_lines l ON l.account_id = a.id
 GROUP BY a.id;

-- 7. Partial-text search (pg_trgm) ----------------------------------------------------
CREATE INDEX IF NOT EXISTS containers_number_trgm_idx ON containers USING gin (container_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS containers_bl_trgm_idx ON containers USING gin (bill_of_lading_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS traders_name_trgm_idx ON traders USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS parties_name_trgm_idx ON parties USING gin (name gin_trgm_ops);
