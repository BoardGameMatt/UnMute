-- Local development seed, auto-applied by `supabase start` / `supabase db reset`.
--
-- The migrations enable RLS and define policies but never explicitly GRANT
-- table privileges to the PostgREST API roles. Hosted Supabase historically
-- granted DML on new `public` tables to anon/authenticated/service_role via
-- default privileges, but recent Supabase Postgres images restrict the public
-- schema default to TRUNCATE/REFERENCES/TRIGGER only. Without the grants below,
-- every API call (and the seed scripts) fails with "permission denied for
-- table ...". Row-level security still governs what each role may actually
-- read/write; these grants only restore table-level access so RLS can apply.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO anon, authenticated, service_role;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public
  TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public
  TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
  TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES
  TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS
  TO anon, authenticated, service_role;
