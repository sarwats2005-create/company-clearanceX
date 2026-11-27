-- Least-privilege database login for the running app (OWASP / Neon guidance: the app must not use the owner role).
--
-- Run ONCE as the database owner (e.g. neondb_owner) in Neon's SQL Editor, after the app has started at least once
-- (so the tables exist). Then in Railway:
--   DATABASE_URL           = the pooled connection string, but with user clearance_app and the password below
--   DATABASE_URL_UNPOOLED  = keep the owner's direct connection string (used only to update tables at start)
--
-- What the app can then NOT do, even if it were ever taken over: drop or alter tables, remove the safety
-- triggers, rewrite or delete ledger lines, charge splits or the audit log, or delete journal entries.

-- 1. Choose a long random password (at least 32 characters) and replace it here.
CREATE ROLE clearance_app LOGIN PASSWORD 'REPLACE-WITH-A-LONG-RANDOM-PASSWORD';

-- 2. Basic access to this database and its tables (data only, no schema changes).
DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO clearance_app', current_database()); END $$;
GRANT USAGE ON SCHEMA public TO clearance_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO clearance_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO clearance_app;

-- 3. Tables added by future updates get the same access automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO clearance_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO clearance_app;

-- 4. History can only grow: no changing or deleting it.
REVOKE UPDATE, DELETE, TRUNCATE ON journal_lines, container_charge_allocations, audit_log FROM clearance_app;
REVOKE DELETE, TRUNCATE ON journal_entries, container_charges, entry_containers FROM clearance_app;
-- Restore points are written only by the database's own functions (src/db/sql/0003_restore_points.sql).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON restore_points FROM clearance_app;

-- 5. Never let the app create objects in the schema (default since Postgres 15; stated explicitly).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Check: this should list clearance_app with its privileges.
SELECT grantee, table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants WHERE grantee = 'clearance_app' GROUP BY grantee, table_name ORDER BY table_name;
