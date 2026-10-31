#!/usr/bin/env bash
# Applies supabase/migrations/*.sql in order, once each, tracking them in
# supabase_migrations.schema_migrations (same table as the Supabase CLI).
# On a fresh database it also loads supabase/seed.sql (sample courts).
set -euo pipefail

psql_() { psql -v ON_ERROR_STOP=1 -X -q "$@"; }

psql_ -c "create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);"

fresh=$(psql_ -At -c "select count(*) = 0 from supabase_migrations.schema_migrations")

for f in /supabase/migrations/*.sql; do
  base=$(basename "$f" .sql)
  version=${base%%_*}
  name=${base#*_}
  if [[ -n $(psql_ -At -c "select 1 from supabase_migrations.schema_migrations where version = '$version'") ]]; then
    continue
  fi
  echo "→ migration $base"
  psql_ --single-transaction -f "$f" \
    -c "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name')"
done

if [[ $fresh == "t" && -f /supabase/seed.sql ]]; then
  echo "→ seed.sql"
  psql_ -f /supabase/seed.sql
fi

echo "✓ database up to date"
