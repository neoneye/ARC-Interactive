#!/usr/bin/env bash
# Runs supabase/schema.sql and its tests against a throwaway local Postgres cluster.
# Usage: supabase/test/run-tests.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
schema="$here/../schema.sql"

pgbin=/opt/homebrew/opt/postgresql@16/bin
if [ -d "$pgbin" ]; then
  export PATH="$pgbin:$PATH"
fi
for tool in initdb pg_ctl psql; do
  command -v "$tool" >/dev/null || { echo "Missing $tool: install PostgreSQL (e.g. brew install postgresql@16)" >&2; exit 1; }
done

# A bad LANG/LC_* in the environment stops the server from starting on macOS.
export LC_ALL=C

port=54329
tmp="$(mktemp -d /tmp/arc-sql-tests.XXXXXX)"
cleanup() {
  pg_ctl -D "$tmp/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

initdb -D "$tmp/data" -U postgres --auth=trust --locale=C -E UTF8 >/dev/null
if ! pg_ctl -D "$tmp/data" -l "$tmp/server.log" -w \
  -o "-p $port -k $tmp -c listen_addresses=''" start >/dev/null; then
  cat "$tmp/server.log" >&2
  exit 1
fi

export PGOPTIONS="-c client_min_messages=warning"
run_sql() {
  psql -h "$tmp" -p "$port" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 -f "$1"
}

run_sql "$here/supabase-stub.sql"
run_sql "$schema"
run_sql "$here/schema-tests.sql"

# schema.sql must be safe to run twice (Supabase's SQL editor gets re-run).
echo "Re-running schema.sql and the tests on the same database..."
run_sql "$schema"
run_sql "$here/schema-tests.sql" >/dev/null

echo "ALL SQL TESTS PASSED"
