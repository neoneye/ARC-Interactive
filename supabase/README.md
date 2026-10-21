# Supabase setup for puzzle submissions

Players' fully solved puzzles are sent to a Supabase table. Only the owner
(`neoneye@gmail.com`) can read, review, download and delete them.

## One-time setup

1. Paste `schema.sql` into the Supabase SQL editor and run it. It is safe to run again.
2. Create the user `neoneye@gmail.com` under Auth -> Users ("Add user"). There is no need to
   "Send magic link".
3. Auth -> URL Configuration:
   - Site URL: `https://neoneye.github.io/arc/`
   - Redirect URLs:
     - `https://neoneye.github.io/arc/review.html`
     - `https://neoneye.github.io/arc-staging/review.html`
     - `http://127.0.0.1:5500/**`
     - `http://localhost:5500/**`
4. Copy the anon/publishable key from Project Settings -> API into `webroot/supabase-config.js`.

## Workflow

Download -> `full_sync.py` -> Delete.

## Tests

`supabase/test/run-tests.sh` starts a throwaway Postgres cluster, loads `test/supabase-stub.sql`
(stand-ins for Supabase's roles and `auth.jwt()`), then `schema.sql`, then `test/schema-tests.sql`.
It needs the Postgres binaries (`initdb`, `pg_ctl`, `psql`), e.g. `brew install postgresql@16`.
No Docker or Supabase account is involved.
