#!/usr/bin/env bash
# Database tests on a plain PostgreSQL 16 (no Docker, no Supabase CLI).
#
#   npm run test:db
#
# Without DATABASE_URL: creates a throwaway cluster in a temp dir (trust auth,
# 127.0.0.1 on a free port), applies supabase/tests/00_supabase_stub.sql, every
# migration in order and supabase/seed.sql, runs the Vitest suite and removes
# the cluster on exit. PostgreSQL binaries are taken from $PG_BIN, from
# `pg_config --bindir` or from /usr/lib/postgresql/16/bin.
#
# With DATABASE_URL (e.g. a `postgres:16` service in CI): uses that empty
# database instead of creating a cluster. Requires `psql` on PATH.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TMP=""
PG_CTL=""
RUN_AS=()

cleanup() {
  if [[ -n "$TMP" && -d "$TMP" ]]; then
    if [[ -n "$PG_CTL" && -f "$TMP/data/postmaster.pid" ]]; then
      "${RUN_AS[@]}" "$PG_CTL" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
    fi
    rm -rf "$TMP"
  fi
}
trap cleanup EXIT INT TERM

if [[ -z "${DATABASE_URL:-}" ]]; then
  PG_BIN="${PG_BIN:-}"
  if [[ -z "$PG_BIN" ]]; then
    if command -v pg_config >/dev/null 2>&1 && [[ -x "$(pg_config --bindir)/initdb" ]]; then
      PG_BIN="$(pg_config --bindir)"
    else
      PG_BIN=/usr/lib/postgresql/16/bin
    fi
  fi
  [[ -x "$PG_BIN/initdb" ]] || { echo "initdb not found (set PG_BIN or DATABASE_URL)" >&2; exit 1; }
  PG_CTL="$PG_BIN/pg_ctl"
  PSQL_BIN="$PG_BIN/psql"
  [[ -x "$PSQL_BIN" ]] || PSQL_BIN="$(command -v psql)"

  TMP="$(mktemp -d "${TMPDIR:-/tmp}/padel-db-test.XXXXXX")"
  chmod 755 "$TMP"
  # PostgreSQL refuses to run as root: use the `postgres` OS user (created if missing).
  if [[ "$(id -u)" == "0" ]]; then
    if ! id postgres >/dev/null 2>&1; then
      useradd --system --no-create-home --shell /usr/sbin/nologin postgres
    fi
    chown postgres "$TMP"
    if command -v runuser >/dev/null 2>&1; then
      RUN_AS=(runuser -u postgres --)
    else
      RUN_AS=(su postgres -s /bin/sh -c '"$0" "$@"')
    fi
  else
    RUN_AS=(env)
  fi

  PORT="${PGTEST_PORT:-}"
  if [[ -z "$PORT" ]]; then
    for p in $(seq 54329 54399); do
      if ! (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then PORT=$p; break; fi
    done
  fi
  [[ -n "$PORT" ]] || { echo "no free port" >&2; exit 1; }

  (cd "$TMP" && "${RUN_AS[@]}" "$PG_BIN/initdb" -D "$TMP/data" -U postgres -A trust -E UTF8 --no-locale >/dev/null)
  (cd "$TMP" && "${RUN_AS[@]}" "$PG_CTL" -D "$TMP/data" -w -l "$TMP/postgres.log" \
    -o "-p $PORT -k $TMP -c listen_addresses=127.0.0.1 -c fsync=off -c max_connections=50 -c wal_level=logical" start >/dev/null)
  "$PSQL_BIN" -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -qAt -c "create database padel_test" >/dev/null
  export DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/padel_test"
else
  PSQL_BIN="$(command -v psql)"
fi

apply() {
  PGOPTIONS="-c client_min_messages=warning" "$PSQL_BIN" "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -X -f "$1" >/dev/null
}

echo "→ Supabase stub"
apply supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "→ $(basename "$f")"
  apply "$f"
done
echo "→ seed.sql"
apply supabase/seed.sql

npx vitest run --config vitest.db.config.ts "$@"
