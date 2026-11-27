-- Runs BEFORE the drizzle migrations (extensions the schema relies on).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
