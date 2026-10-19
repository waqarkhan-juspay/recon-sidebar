-- The shared sidebar for the recon alignment demo (the `sidebar` branch).
--
-- Sign-in is Google (juspay.in accounts), set up under Authentication → Providers.
--
-- Run once in the Supabase SQL editor, then run supabase/allowlist.sql (not in git — it
-- holds the editors' emails). Safe to re-run.
--
-- Who can do what:
--   anyone, signed in or not ("Continue as guest")  read the sidebar
--   an email in allowed_emails, signed in            edit it, and read the version history
-- Enforced here, not in the app: the app's code is public, so the database is the gate.

-- Editors. No policies, so nobody reads or writes this through the API; the functions
-- below look into it on the caller's behalf.
create table if not exists public.allowed_emails (email text primary key);
alter table public.allowed_emails enable row level security;

-- Is the signed-in caller an editor?
create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from allowed_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Sign-in is with Google now; nothing needs to ask about an email before it signs in.
drop function if exists public.can_sign_in(text);

-- The sidebar as it stands: one row.
create table if not exists public.nav_state (
  id int primary key default 1 check (id = 1),
  state jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.nav_state enable row level security;
drop policy if exists "anyone can view the sidebar" on public.nav_state;
create policy "anyone can view the sidebar" on public.nav_state for select using (true);

-- Version history: every change, who made it, and the sidebar as it was afterwards.
create table if not exists public.nav_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_email text not null,
  kind text not null,
  summary text not null,
  snapshot jsonb not null
);
alter table public.nav_events enable row level security;
drop policy if exists "editors can view history" on public.nav_events;
create policy "editors can view history" on public.nav_events
  for select to authenticated using (public.is_editor());

-- The only way to change anything: saves the new sidebar and logs the change together, as
-- the signed-in editor. Neither table has an insert or update policy, so this is the door.
create or replace function public.save_nav(new_state jsonb, change_kind text, change_summary text)
returns void language plpgsql security definer set search_path = public as $$
declare
  who text := auth.jwt() ->> 'email';
begin
  if not public.is_editor() then
    raise exception 'Only editors can change the sidebar' using errcode = '42501';
  end if;
  insert into nav_state (id, state, updated_at, updated_by)
    values (1, new_state, now(), who)
    on conflict (id) do update
      set state = excluded.state, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  insert into nav_events (actor_email, kind, summary, snapshot)
    values (who, change_kind, change_summary, new_state);
end;
$$;

revoke all on function public.is_editor() from public;
revoke all on function public.save_nav(jsonb, text, text) from public;
grant execute on function public.is_editor() to anon, authenticated;
grant execute on function public.save_nav(jsonb, text, text) to authenticated;

-- Live updates: everyone's open tabs follow each other's edits.
do $$
begin
  alter publication supabase_realtime add table public.nav_state;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.nav_events;
exception when duplicate_object then null;
end $$;
