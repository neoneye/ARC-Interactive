-- Stands in for the parts of Supabase's environment that schema.sql relies on,
-- so the schema can be tested on plain Postgres.

create role anon nologin;
create role authenticated nologin;

-- auth.jwt() reads the claims that PostgREST sets for each request.
create schema auth;
create function auth.jwt() returns jsonb
language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;

-- Supabase's default privileges: tables in public are granted to anon and
-- authenticated, so row level security (not missing grants) is what gets tested.
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
