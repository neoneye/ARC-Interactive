-- Tests for supabase/schema.sql. Each test is a DO block that raises on failure;
-- run-tests.sh runs this file with ON_ERROR_STOP, so the first failure aborts the run.
-- A "PASS" line is printed only after its test block succeeds.

-- Discard query results (SELECT output); \echo PASS lines and errors still show.
\o /dev/null

drop schema if exists test_helpers cascade;
create schema test_helpers;
grant usage on schema test_helpers to public;

-- A history payload with the fields submit_history cares about.
create function test_helpers.payload(unsolved int default 0, pad_bytes int default 0)
returns text language sql immutable as $$
  select '{"dataset":"arc-agi-1","task":"0a1b2c3d","summary":{"test unsolved count":'
         || unsolved || '},"pad":"' || repeat('a', pad_bytes) || '"}'
$$;

-- Insert a row directly (run as the table owner).
create function test_helpers.seed(p_uuid uuid) returns void language plpgsql as $$
begin
  insert into public.submissions (update_uuid, dataset_id, task_id, json, json_size, fully_solved)
  values (p_uuid, 'arc-agi-1', 'seed', '{"seed":true}', 13, true);
end $$;

create function test_helpers.claims(p_email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('email', p_email)::text, false)
$$;

-- ---------------------------------------------------------------------------
truncate public.submissions;
select test_helpers.claims(null);
set role anon;
do $$
declare r text;
begin
  r := public.submit_history('11111111-1111-1111-1111-111111111111', test_helpers.payload());
  if r is distinct from 'stored' then raise exception 'expected stored, got %', r; end if;
end $$;
reset role;
do $$
declare s public.submissions;
begin
  if (select count(*) from public.submissions) <> 1 then raise exception 'expected exactly one row'; end if;
  select * into s from public.submissions;
  if s.dataset_id <> 'arc-agi-1' or s.task_id <> '0a1b2c3d' then
    raise exception 'dataset_id/task_id not copied: % / %', s.dataset_id, s.task_id;
  end if;
  if s.json <> test_helpers.payload() then raise exception 'json not stored'; end if;
  if s.json_size <> octet_length(s.json) then raise exception 'json_size wrong: %', s.json_size; end if;
  if s.fully_solved is not true then raise exception 'fully_solved should be true'; end if;
  if s.review_status <> 'pending' then raise exception 'review_status should be pending'; end if;
  if s.update_uuid <> '11111111-1111-1111-1111-111111111111' then raise exception 'update_uuid wrong'; end if;
end $$;
\echo PASS: anon submit stores row

-- ---------------------------------------------------------------------------
truncate public.submissions;
set role anon;
do $$
declare r1 text; r2 text;
begin
  r1 := public.submit_history('22222222-2222-2222-2222-222222222222', test_helpers.payload(0, 10));
  r2 := public.submit_history('22222222-2222-2222-2222-222222222222', test_helpers.payload(0, 20));
  if r1 <> 'stored' or r2 <> 'stored' then raise exception 'expected stored/stored, got %/%', r1, r2; end if;
end $$;
reset role;
do $$
declare s public.submissions;
begin
  if (select count(*) from public.submissions) <> 1 then raise exception 'expected still one row'; end if;
  select * into s from public.submissions;
  if s.json <> test_helpers.payload(0, 20) then raise exception 'json not replaced by second submit'; end if;
  if s.json_size <> octet_length(s.json) then raise exception 'json_size not updated'; end if;
  if s.updated_at < s.created_at then raise exception 'updated_at < created_at'; end if;
end $$;
\echo PASS: same uuid upserts

-- ---------------------------------------------------------------------------
-- A resubmitted (still pending) row must no longer count as downloaded.
truncate public.submissions;
set role anon;
select public.submit_history('23232323-2323-2323-2323-232323232323', test_helpers.payload(0, 10));
reset role;
update public.submissions set downloaded_at = now() where update_uuid = '23232323-2323-2323-2323-232323232323';
set role anon;
do $$
declare r text;
begin
  r := public.submit_history('23232323-2323-2323-2323-232323232323', test_helpers.payload(0, 20));
  if r <> 'stored' then raise exception 'expected stored, got %', r; end if;
end $$;
reset role;
do $$
declare s public.submissions;
begin
  select * into s from public.submissions where update_uuid = '23232323-2323-2323-2323-232323232323';
  if s.downloaded_at is not null then raise exception 'resubmit did not clear downloaded_at'; end if;
  if s.json <> test_helpers.payload(0, 20) then raise exception 'json not replaced by resubmit'; end if;
end $$;
\echo PASS: resubmit clears downloaded_at

-- ---------------------------------------------------------------------------
truncate public.submissions;
set role anon;
select public.submit_history('33333333-3333-3333-3333-333333333333', test_helpers.payload(0, 10));
reset role;
update public.submissions set review_status = 'approved';
set role anon;
do $$
declare r text;
begin
  r := public.submit_history('33333333-3333-3333-3333-333333333333', test_helpers.payload(0, 99));
  if r is distinct from 'ignored' then raise exception 'expected ignored, got %', r; end if;
end $$;
reset role;
do $$
declare s public.submissions;
begin
  select * into s from public.submissions;
  if s.review_status <> 'approved' then raise exception 'status changed to %', s.review_status; end if;
  if s.json <> test_helpers.payload(0, 10) then raise exception 'json of reviewed row was overwritten'; end if;
end $$;
\echo PASS: upsert ignores reviewed row

-- ---------------------------------------------------------------------------
truncate public.submissions;
set role anon;
do $$
declare accepted boolean := false;
begin
  begin
    perform public.submit_history(gen_random_uuid(), test_helpers.payload(1));
    accepted := true;
  exception when others then
    null;
  end;
  if accepted then raise exception 'unsolved history was accepted'; end if;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.submissions) <> 0 then raise exception 'unsolved history was stored'; end if;
end $$;
\echo PASS: rejects unsolved

-- ---------------------------------------------------------------------------
truncate public.submissions;
set role anon;
do $$
declare
  prefix text := '{"dataset":"d","task":"t","summary":{"test unsolved count":0},"pad":"';
  suffix text := '"}';
  cases text[] := array[
    'this is not json',
    '{"dataset":"d","task":"t","summary":',
    '[1,2,3]',
    '{"task":"t","summary":{"test unsolved count":0}}',
    '{"dataset":"d","task":"","summary":{"test unsolved count":0}}',
    '{"dataset":"d","summary":{"test unsolved count":0}}',
    '{"dataset":"d","task":"t"}',
    '{"dataset":"d","task":"t","summary":{}}',
    '',
    prefix || repeat('a', 5 * 1024 * 1024 + 1 - octet_length(prefix) - octet_length(suffix)) || suffix
  ];
  c text;
  accepted boolean;
  i int := 0;
begin
  -- the last case is exactly 5 MiB + 1 byte
  if octet_length(cases[array_length(cases, 1)]) <> 5 * 1024 * 1024 + 1 then
    raise exception 'test bug: oversize case has the wrong size';
  end if;
  foreach c in array cases loop
    i := i + 1;
    accepted := false;
    begin
      perform public.submit_history(gen_random_uuid(), c);
      accepted := true;
    exception when others then
      null;
    end;
    if accepted then raise exception 'bad input case % was accepted', i; end if;
  end loop;
  -- null json too
  accepted := false;
  begin
    perform public.submit_history(gen_random_uuid(), null);
    accepted := true;
  exception when others then
    null;
  end;
  if accepted then raise exception 'null json was accepted'; end if;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.submissions) <> 0 then raise exception 'bad input was stored'; end if;
end $$;
\echo PASS: rejects bad input

-- ---------------------------------------------------------------------------
truncate public.submissions;
set role anon;
do $$
declare r text;
begin
  r := public.submit_history('44444444-4444-4444-4444-444444444444', test_helpers.payload(0, 2500000));
  if r is distinct from 'stored' then raise exception 'expected stored, got %', r; end if;
end $$;
reset role;
do $$
declare s public.submissions;
begin
  select * into s from public.submissions;
  if s.json_size < 2500000 or s.json_size <> octet_length(s.json) then
    raise exception 'large payload not stored correctly: %', s.json_size;
  end if;
end $$;
\echo PASS: accepts large

-- ---------------------------------------------------------------------------
truncate public.submissions;
set role anon;
do $$
declare
  j text := '{"dataset":"d","task":"t","summary":{"test unsolved count":0},'
            || '"msg":"it''s \"quoted\" \\ </script> ü 🧩"}';
begin
  perform public.submit_history('55555555-5555-5555-5555-555555555555', j);
  -- keep the input for the check below (anon cannot read the table)
  perform set_config('test.verbatim', j, false);
end $$;
reset role;
do $$
declare stored text;
begin
  select json into stored from public.submissions;
  if stored is distinct from current_setting('test.verbatim') then
    raise exception 'json was not stored verbatim: %', stored;
  end if;
  if position('\"quoted\" \\ </script> ü 🧩' in stored) = 0 then
    raise exception 'test bug: expected characters missing from the input';
  end if;
end $$;
\echo PASS: verbatim round-trip

-- ---------------------------------------------------------------------------
truncate public.submissions;
select test_helpers.seed('66666666-6666-6666-6666-666666666666');
select test_helpers.claims(null);
set role anon;
do $$
declare n bigint;
begin
  -- Either an error or zero visible/affected rows counts as "cannot touch".
  begin
    select count(*) into n from public.submissions;
  exception when insufficient_privilege then n := 0; end;
  if n <> 0 then raise exception 'anon can see % rows', n; end if;

  begin
    update public.submissions set review_status = 'approved';
    get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0; end;
  if n <> 0 then raise exception 'anon updated % rows', n; end if;

  begin
    delete from public.submissions;
    get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0; end;
  if n <> 0 then raise exception 'anon deleted % rows', n; end if;

  begin
    insert into public.submissions (update_uuid, dataset_id, task_id, json, json_size, fully_solved)
    values (gen_random_uuid(), 'd', 't', '{}', 2, true);
    get diagnostics n = row_count;
    raise exception 'anon inserted % rows', n;
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.submissions) <> 1 then raise exception 'anon changed the table'; end if;
  if (select review_status from public.submissions) <> 'pending' then raise exception 'anon changed a status'; end if;
end $$;
\echo PASS: anon cannot touch table

-- ---------------------------------------------------------------------------
truncate public.submissions;
select test_helpers.seed('77777777-7777-7777-7777-777777777777');
select test_helpers.claims('someone@example.com');
set role authenticated;
do $$
declare n bigint;
begin
  select count(*) into n from public.submissions;
  if n <> 0 then raise exception 'non-admin sees % rows', n; end if;

  update public.submissions set review_status = 'approved';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'non-admin updated % rows', n; end if;

  delete from public.submissions;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'non-admin deleted % rows', n; end if;

  if public.is_admin() then raise exception 'is_admin() true for non-admin'; end if;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.submissions) <> 1 then raise exception 'non-admin deleted the row'; end if;
  if (select review_status from public.submissions) <> 'pending' then raise exception 'non-admin changed the status'; end if;
end $$;
\echo PASS: non-admin authenticated sees and changes nothing

-- ---------------------------------------------------------------------------
truncate public.submissions;
select test_helpers.seed('88888888-8888-8888-8888-888888888881');
select test_helpers.seed('88888888-8888-8888-8888-888888888882');
select test_helpers.claims('neoneye@gmail.com');
set role authenticated;
do $$
declare n bigint; s public.submissions; denied boolean;
begin
  if not public.is_admin() then raise exception 'is_admin() false for admin'; end if;

  select count(*) into n from public.submissions;
  if n <> 2 then raise exception 'admin sees % rows, expected 2', n; end if;

  update public.submissions set review_status = 'approved', downloaded_at = now()
   where update_uuid = '88888888-8888-8888-8888-888888888881';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'admin update affected % rows', n; end if;
  select * into s from public.submissions where update_uuid = '88888888-8888-8888-8888-888888888881';
  if s.review_status <> 'approved' or s.downloaded_at is null then raise exception 'admin update not applied'; end if;
  if s.updated_at < s.created_at then raise exception 'updated_at < created_at'; end if;

  -- column-level grants: only review_status and downloaded_at are updatable
  denied := false;
  begin
    update public.submissions set json = '{"tampered":true}';
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'admin could update json'; end if;

  denied := false;
  begin
    update public.submissions set dataset_id = 'x';
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'admin could update dataset_id'; end if;

  delete from public.submissions where update_uuid = '88888888-8888-8888-8888-888888888882';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'admin delete affected % rows', n; end if;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.submissions) <> 1 then raise exception 'expected one row left after admin delete'; end if;
  if (select json from public.submissions) <> '{"seed":true}' then raise exception 'json was tampered with'; end if;
end $$;
\echo PASS: admin can review

-- ---------------------------------------------------------------------------
truncate public.submissions;
select test_helpers.seed('99999999-9999-9999-9999-999999999999');
select test_helpers.claims('neoneye@gmail.com');
set role authenticated;
do $$
declare denied boolean := false;
begin
  begin
    update public.submissions set review_status = 'bogus';
  exception when check_violation then denied := true; end;
  if not denied then raise exception 'bogus review_status was accepted'; end if;
end $$;
reset role;
\echo PASS: status check

truncate public.submissions;
select test_helpers.claims(null);
drop schema test_helpers cascade;
