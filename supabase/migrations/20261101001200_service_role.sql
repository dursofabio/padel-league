-- service_role (server-side only: cron, seed, admin) must be able to run the private helpers
-- that triggers and RPCs call, e.g. the role guard on profiles. Without this, an UPDATE on profiles
-- made by service_role fails with "permission denied for schema private".
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;
alter default privileges for role postgres in schema private grant execute on functions to service_role;
