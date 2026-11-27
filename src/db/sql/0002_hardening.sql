-- Database hardening (security review 2026-11). Runs on every start after the migrations; every statement is
-- idempotent. Goals: the audit trail can't be rewritten, and impossible values can't be stored even if a bug or
-- an attacker reached the database directly.

-- ── 1. The audit log is append-only ─────────────────────────────────────────────
-- Same guard as the money tables (cc_block_change from 0001): any UPDATE or DELETE raises an error.
DROP TRIGGER IF EXISTS cc_audit_log_immutable ON audit_log;
CREATE TRIGGER cc_audit_log_immutable
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION cc_block_change();

-- ── 2. Value checks ─────────────────────────────────────────────────────────────
-- Added NOT VALID so a start never fails on old rows; then validated when the existing rows already pass.
-- New and changed rows are always checked.
CREATE OR REPLACE FUNCTION cc_add_check(tbl text, name text, expr text) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = name) THEN
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%s) NOT VALID', tbl, name, expr);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = name AND NOT convalidated) THEN
        BEGIN
            EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', tbl, name);
        EXCEPTION WHEN check_violation THEN
            RAISE WARNING 'constraint % on % stays NOT VALID: existing rows break it', name, tbl;
        END;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Ledger lines: never negative, exactly one side used.
SELECT cc_add_check('journal_lines', 'cc_journal_lines_one_side_ck', 'debit >= 0 AND credit >= 0 AND ((debit = 0) <> (credit = 0))');
-- Exchange rates are positive.
SELECT cc_add_check('journal_entries', 'cc_journal_entries_fx_rate_ck', 'fx_rate IS NULL OR fx_rate > 0');
SELECT cc_add_check('company_settings', 'cc_company_settings_rate_ck', 'default_usd_iqd_rate > 0');
SELECT cc_add_check('company_settings', 'cc_company_settings_warning_days_ck', 'arrived_warning_days BETWEEN 0 AND 3650');
-- Charges and their parts.
SELECT cc_add_check('container_charges', 'cc_container_charges_amount_ck', 'amount > 0');
SELECT cc_add_check('container_charge_allocations', 'cc_allocations_amount_ck', 'amount >= 0');
SELECT cc_add_check('charge_type_defaults', 'cc_charge_type_defaults_amount_ck', 'amount > 0');
-- Receipt numbers only move forward from 1.
SELECT cc_add_check('receipt_sequences', 'cc_receipt_sequences_next_ck', 'next_number >= 1');
-- Containers and shares.
SELECT cc_add_check('containers', 'cc_containers_quantity_ck', 'quantity >= 0');
SELECT cc_add_check('container_shares', 'cc_container_shares_values_ck', '(share_value IS NULL OR share_value >= 0) AND (cartons IS NULL OR cartons >= 0) AND (weight_kg IS NULL OR weight_kg >= 0)');
-- Logos are small images only (no scripts, no huge blobs).
SELECT cc_add_check('shipping_lines', 'cc_shipping_lines_logo_ck', $c$logo IS NULL OR (length(logo) <= 300000 AND logo ~ '^data:image/(png|jpeg|webp);base64,')$c$);
-- Logins.
SELECT cc_add_check('users', 'cc_users_username_ck', 'length(username) BETWEEN 1 AND 100');
SELECT cc_add_check('users', 'cc_users_password_hash_ck', $c$password_hash LIKE 'scrypt$%'$c$);
SELECT cc_add_check('sessions', 'cc_sessions_id_ck', 'length(id) = 64');
