-- Puzzle submissions for ARC-Interactive.
-- Paste this whole file into the Supabase SQL editor and run it. It is idempotent.

create table if not exists public.submissions (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  update_uuid   uuid not null unique,
  dataset_id    text not null,
  task_id       text not null,
  json          text not null,
  json_size     int not null,
  fully_solved  boolean not null,
  review_status text not null default 'pending',
  downloaded_at timestamptz,
  constraint submissions_review_status_check
    check (review_status in ('pending', 'approved', 'rejected'))
);

-- The one place that decides who the admin is.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email' = 'neoneye@gmail.com', false)
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Row level security: only the admin gets at the table directly.
alter table public.submissions enable row level security;

drop policy if exists submissions_admin_select on public.submissions;
create policy submissions_admin_select on public.submissions
  for select to authenticated using (public.is_admin());

drop policy if exists submissions_admin_update on public.submissions;
create policy submissions_admin_update on public.submissions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists submissions_admin_delete on public.submissions;
create policy submissions_admin_delete on public.submissions
  for delete to authenticated using (public.is_admin());

-- Table privileges (belt and braces on top of RLS; RLS does not cover TRUNCATE).
-- anon gets nothing; submissions go through submit_history() below.
-- authenticated can read and delete, and update only the review columns.
revoke all on public.submissions from anon, authenticated;
grant select, delete on public.submissions to authenticated;
grant update (review_status, downloaded_at) on public.submissions to authenticated;

-- Keep updated_at current.
create or replace function public.submissions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists submissions_set_updated_at on public.submissions;
create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.submissions_set_updated_at();

-- Public entry point for the game: validates and stores a fully solved history.
-- Returns 'stored', or 'ignored' when the row was already reviewed.
create or replace function public.submit_history(p_update_uuid uuid, p_json text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max_bytes constant int := 5 * 1024 * 1024;
  v_size      int;
  v_json      jsonb;
  v_unsolved  jsonb;
  v_dataset   text;
  v_task      text;
begin
  if p_update_uuid is null or p_json is null then
    raise exception 'update_uuid and json are required';
  end if;

  v_size := octet_length(p_json);
  if v_size > v_max_bytes then
    raise exception 'history too large: % bytes (limit % bytes)', v_size, v_max_bytes;
  end if;

  v_json := p_json::jsonb;  -- raises on invalid JSON
  if jsonb_typeof(v_json) <> 'object' then
    raise exception 'history must be a JSON object';
  end if;

  if jsonb_typeof(v_json -> 'dataset') = 'string' then v_dataset := btrim(v_json ->> 'dataset'); end if;
  if jsonb_typeof(v_json -> 'task') = 'string' then v_task := btrim(v_json ->> 'task'); end if;
  if coalesce(v_dataset, '') = '' or coalesce(v_task, '') = '' then
    raise exception 'history must contain a dataset and a task';
  end if;

  if jsonb_typeof(v_json -> 'summary') <> 'object' then
    raise exception 'history must contain a summary';
  end if;

  v_unsolved := v_json -> 'summary' -> 'test unsolved count';
  if jsonb_typeof(v_unsolved) is distinct from 'number' or (v_unsolved)::text::numeric <> 0 then
    raise exception 'history is not fully solved';
  end if;

  insert into public.submissions as s
    (update_uuid, dataset_id, task_id, json, json_size, fully_solved)
  values
    (p_update_uuid, v_dataset, v_task, p_json, v_size, true)
  on conflict (update_uuid) do update
    set dataset_id   = excluded.dataset_id,
        task_id      = excluded.task_id,
        json         = excluded.json,
        json_size    = excluded.json_size,
        fully_solved = excluded.fully_solved,
        updated_at   = now()
    where s.review_status = 'pending';

  if found then
    return 'stored';
  end if;
  return 'ignored';
end $$;

revoke execute on function public.submit_history(uuid, text) from public;
grant execute on function public.submit_history(uuid, text) to anon, authenticated;
