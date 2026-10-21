# Supabase setup for puzzle submissions

Players' fully solved puzzles are sent to a Supabase table. Only the owner
(`neoneye@gmail.com`) can read, review, download and delete them.

## One-time setup

Row-level security trusts the `email` claim of the signed-in user's JWT, so the Auth settings below
must be pinned before the schema goes live. Only that claim gates admin access; the client's
`shouldCreateUser: false` is not a server-side control.

1. Auth -> Users -> "Add user": create `neoneye@gmail.com` FIRST, with "Auto Confirm User" ticked.
   There is no need to "Send magic link".
2. Auth -> Sign In / Providers:
   - Turn OFF "Allow new users to sign up" (magic link still works for the existing user).
   - Keep "Confirm email" ON.
   - Leave anonymous sign-ins and all OAuth providers off.
3. Paste `schema.sql` into the Supabase SQL editor and run it. It is safe to run again.
4. Auth -> URL Configuration:
   - Site URL: `https://neoneye.github.io/arc/`
   - Redirect URLs:
     - `https://neoneye.github.io/arc/**`
     - `https://neoneye.github.io/arc-staging/**`
     - `http://127.0.0.1:5500/**`
     - `http://localhost:5500/**`
5. Copy the anon/publishable key from Project Settings -> API into `webroot/supabase-config.js`.

Notes:

- Supabase's built-in SMTP only sends to project team members and is rate limited (a few emails per
  hour). That is fine for a single admin.
- The auth session is kept in `localStorage` on `neoneye.github.io`, which is shared by all of
  Simon's GitHub Pages sites. Sign out after reviewing.

## Workflow

Download -> `full_sync.py` -> Delete.

## Tests

`supabase/test/run-tests.sh` starts a throwaway Postgres cluster, loads `test/supabase-stub.sql`
(stand-ins for Supabase's roles and `auth.jwt()`), then `schema.sql`, then `test/schema-tests.sql`.
It needs the Postgres binaries (`initdb`, `pg_ctl`, `psql`), e.g. `brew install postgresql@16`.
No Docker or Supabase account is involved.
