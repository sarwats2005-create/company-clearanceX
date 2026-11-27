-- Restore points ("نقاط الاسترجاع") and "start fresh" ("البدء من جديد").
-- Runs on every start after the migrations; every statement is idempotent.
--
-- Everything that copies or wipes data lives HERE, inside the database, not in the app:
--   * a point is a copy the database makes itself (the app can't insert a made-up point);
--   * every restore and every fresh start first saves an automatic point, so each one can be undone;
--   * a fresh start is refused unless the owner saved a point himself today (Baghdad time);
--   * points saved today can't be deleted, so that same-day undo is always there.
-- The functions run as the database owner (SECURITY DEFINER). The app's restricted user (clearance_app) can call
-- them but can't truncate tables or write restore_points itself (see the end of this file).
--
-- Logins (users, sessions, login_attempts), the audit log and restore_points are never copied or wiped:
-- a restore never brings back an old password, and the history of what happened stays complete.

-- ── 1. Which tables a point holds (in the order they are put back: parents first) ─────────────
CREATE OR REPLACE FUNCTION cc_restore_tables() RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
    SELECT ARRAY[
        -- settings and lists
        'parties', 'vaults', 'shipping_lines', 'container_sizes', 'ports_of_loading', 'charge_types',
        'charge_type_defaults', 'expense_categories', 'company_settings', 'receipt_sequences',
        -- business records
        'traders', 'containers', 'container_shares', 'container_status_history', 'accounts', 'journal_entries',
        'journal_lines', 'entry_containers', 'container_charges', 'container_charge_allocations'
    ]
$$;

-- What a fresh start that keeps the settings removes: containers, money and their history.
-- The lists (traders, parties, vaults, expense types, shipping lines…) stay, with every balance back at zero.
CREATE OR REPLACE FUNCTION cc_record_tables() RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
    SELECT ARRAY[
        'containers', 'container_shares', 'container_status_history', 'accounts', 'journal_entries',
        'journal_lines', 'entry_containers', 'container_charges', 'container_charge_allocations'
    ]
$$;

-- ── 2. Helpers (no SECURITY DEFINER: as the app's user they can do nothing) ─────────────────
CREATE OR REPLACE FUNCTION cc_lock_tables(tables text[], lock_mode text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF lock_mode NOT IN ('SHARE', 'ACCESS EXCLUSIVE') THEN
        RAISE EXCEPTION 'bad lock mode %', lock_mode;
    END IF;
    EXECUTE format('LOCK TABLE %s IN %s MODE', (SELECT string_agg(format('%I', t), ', ') FROM unnest(tables) t), lock_mode);
END;
$$;

-- TRUNCATE (not DELETE): the row-level "money records are immutable" triggers stay in force for normal use.
CREATE OR REPLACE FUNCTION cc_wipe_tables(tables text[]) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE format('TRUNCATE %s', (SELECT string_agg(format('%I', t), ', ') FROM unnest(tables) t));
END;
$$;

-- ── 3. Save a point ─────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS cc_create_restore_point(text, restore_point_kind, uuid);
CREATE FUNCTION cc_create_restore_point(p_label text, p_kind restore_point_kind, p_user uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    t text;
    v_rows jsonb;
    v_data jsonb := '{}'::jsonb;
    v_counts jsonb := '{}'::jsonb;
    v_text text;
    v_id uuid;
BEGIN
    IF p_kind = 'manual' AND (SELECT count(*) FROM restore_points WHERE kind = 'manual') >= 30 THEN
        RAISE EXCEPTION 'cc_too_many_points';
    END IF;
    -- Writes wait a moment so the copy is consistent across all tables (reads go on as normal).
    PERFORM cc_lock_tables(cc_restore_tables(), 'SHARE');
    FOREACH t IN ARRAY cc_restore_tables() LOOP
        EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) FROM %I x', t) INTO v_rows;
        v_data := v_data || jsonb_build_object(t, v_rows);
        v_counts := v_counts || jsonb_build_object(t, jsonb_array_length(v_rows));
    END LOOP;
    v_text := v_data::text;
    INSERT INTO restore_points (label, kind, format_version, data, counts, checksum, size_bytes, user_id)
    VALUES (
        left(coalesce(nullif(btrim(p_label), ''), 'نقطة استرجاع'), 80),
        p_kind, 1, v_data, v_counts,
        encode(sha256(convert_to(v_text, 'UTF8')), 'hex'),
        octet_length(v_text),
        (SELECT u.id FROM users u WHERE u.id = p_user)
    )
    RETURNING id INTO v_id;
    -- Automatic points: keep the newest 5, and any from the last 30 days.
    DELETE FROM restore_points
     WHERE id IN (SELECT id FROM restore_points WHERE kind <> 'manual' ORDER BY created_at DESC OFFSET 5)
       AND created_at < now() - interval '30 days';
    RETURN v_id;
END;
$$;

-- ── 4. Put a point back ─────────────────────────────────────────────────────────────────────
-- Saves an automatic point of the current data first, so the restore itself can be undone.
DROP FUNCTION IF EXISTS cc_restore_from_point(uuid, uuid);
CREATE FUNCTION cc_restore_from_point(p_id uuid, p_user uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    r restore_points%ROWTYPE;
    t text;
    v_cols text;
    v_vals text;
    v_backup uuid;
BEGIN
    SELECT * INTO r FROM restore_points WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'cc_point_not_found';
    END IF;
    IF r.format_version <> 1 THEN
        RAISE EXCEPTION 'cc_point_unknown_format';
    END IF;
    IF encode(sha256(convert_to(r.data::text, 'UTF8')), 'hex') <> r.checksum THEN
        RAISE EXCEPTION 'cc_point_damaged';
    END IF;

    PERFORM cc_lock_tables(cc_restore_tables(), 'ACCESS EXCLUSIVE');
    v_backup := cc_create_restore_point('تلقائية قبل الاسترجاع', 'before_restore', p_user);
    PERFORM cc_wipe_tables(cc_restore_tables());

    FOREACH t IN ARRAY cc_restore_tables() LOOP
        CONTINUE WHEN NOT (r.data ? t) OR jsonb_array_length(r.data -> t) = 0;
        -- Only columns that exist now AND in the point; new columns get their default.
        -- A user that no longer exists becomes empty instead of failing the whole restore.
        SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum),
               string_agg(CASE WHEN a.attname = 'user_id' THEN '(SELECT u.id FROM users u WHERE u.id = x.user_id)'
                               ELSE format('x.%I', a.attname) END, ', ' ORDER BY a.attnum)
          INTO v_cols, v_vals
          FROM pg_attribute a
         WHERE a.attrelid = format('public.%I', t)::regclass
           AND a.attnum > 0 AND NOT a.attisdropped
           AND (r.data -> t -> 0) ? a.attname;
        EXECUTE format('INSERT INTO %I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::%I, $1) x', t, v_cols, v_vals, t)
            USING r.data -> t;
    END LOOP;
    RETURN v_backup;
END;
$$;

-- ── 5. Start fresh ──────────────────────────────────────────────────────────────────────────
-- Only when the owner saved a point himself TODAY, so a fresh start is always one restore away from undone.
DROP FUNCTION IF EXISTS cc_reset_data(boolean, uuid);
CREATE FUNCTION cc_reset_data(p_keep_settings boolean, p_user uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_backup uuid;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM restore_points WHERE kind = 'manual' AND created_on = (now() AT TIME ZONE 'Asia/Baghdad')::date
    ) THEN
        RAISE EXCEPTION 'cc_no_point_today';
    END IF;
    PERFORM cc_lock_tables(cc_restore_tables(), 'ACCESS EXCLUSIVE');
    v_backup := cc_create_restore_point('تلقائية قبل البدء من جديد', 'before_reset', p_user);
    IF p_keep_settings THEN
        PERFORM cc_wipe_tables(cc_record_tables());
        -- Receipt numbers start again from 1 (their letters stay).
        UPDATE receipt_sequences SET next_number = 1;
    ELSE
        -- Everything goes; the app then puts back the starting lists (src/db/seed.ts).
        PERFORM cc_wipe_tables(cc_restore_tables());
    END IF;
    RETURN v_backup;
END;
$$;

-- ── 6. Delete a point ───────────────────────────────────────────────────────────────────────
-- Only manual points, and not on the day they were saved (today's point is the undo for a fresh start).
DROP FUNCTION IF EXISTS cc_delete_restore_point(uuid);
CREATE FUNCTION cc_delete_restore_point(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    r restore_points%ROWTYPE;
BEGIN
    SELECT * INTO r FROM restore_points WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'cc_point_not_found';
    END IF;
    IF r.kind <> 'manual' THEN
        RAISE EXCEPTION 'cc_point_is_automatic';
    END IF;
    IF r.created_on = (now() AT TIME ZONE 'Asia/Baghdad')::date THEN
        RAISE EXCEPTION 'cc_point_is_from_today';
    END IF;
    DELETE FROM restore_points WHERE id = p_id;
END;
$$;

-- ── 7. Guards ───────────────────────────────────────────────────────────────────────────────
-- A saved point never changes.
DROP TRIGGER IF EXISTS cc_restore_points_immutable ON restore_points;
CREATE TRIGGER cc_restore_points_immutable
    BEFORE UPDATE ON restore_points
    FOR EACH ROW EXECUTE FUNCTION cc_block_change();

-- The helpers are only for the functions above.
REVOKE EXECUTE ON FUNCTION cc_lock_tables(text[], text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION cc_wipe_tables(text[]) FROM PUBLIC;

-- The app's restricted user (when it exists) reads points but writes them only through the functions.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'clearance_app') THEN
        REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON restore_points FROM clearance_app;
        GRANT SELECT ON restore_points TO clearance_app;
    END IF;
END;
$$;
