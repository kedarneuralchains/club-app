-- ============================================================
-- Toastmasters Roles — Migration 015: Admin via Supabase Auth
-- ============================================================
-- Replaces the client-side admin password (which shipped in the JS
-- bundle) with Supabase Auth + an email allowlist. Admin-only writes
-- now require a signed-in user whose email is in `admins`.
--
-- Member-facing writes stay open to anon: role claims, speech details,
-- votes and guest registration.
--
-- After running this, add each admin (they also need an Auth user —
-- Dashboard → Authentication → Users → Add user):
--   insert into admins (email) values ('someone@example.com');
-- ============================================================

create table if not exists admins (
  email      text primary key,
  created_at timestamptz not null default now()
);
-- No policies: the allowlist is only consulted through is_admin().
alter table admins enable row level security;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant execute on function is_admin() to anon, authenticated;

-- ── meetings ────────────────────────────────────────────────
drop policy if exists "anon insert meetings" on meetings;
drop policy if exists "anon update meetings" on meetings;
drop policy if exists "anon delete meetings" on meetings;
create policy "admin insert meetings" on meetings for insert with check (is_admin());
create policy "admin update meetings" on meetings for update using (is_admin()) with check (is_admin());
create policy "admin delete meetings" on meetings for delete using (is_admin());

-- ── members ─────────────────────────────────────────────────
drop policy if exists "anon insert members" on members;
drop policy if exists "anon update members" on members;
create policy "admin insert members" on members for insert with check (is_admin());
create policy "admin update members" on members for update using (is_admin()) with check (is_admin());

-- ── ballots ─────────────────────────────────────────────────
drop policy if exists "anon insert ballots" on ballots;
drop policy if exists "anon update ballots" on ballots;
create policy "admin insert ballots" on ballots for insert with check (is_admin());
create policy "admin update ballots" on ballots for update using (is_admin()) with check (is_admin());

-- ── announcements ───────────────────────────────────────────
drop policy if exists "anon insert announcements" on announcements;
drop policy if exists "anon update announcements" on announcements;
drop policy if exists "anon delete announcements" on announcements;
create policy "admin insert announcements" on announcements for insert with check (is_admin());
create policy "admin update announcements" on announcements for update using (is_admin()) with check (is_admin());
create policy "admin delete announcements" on announcements for delete using (is_admin());

-- ── guest registrations (anon insert from 007 stays) ────────
create policy "admin read guest_registrations" on guest_registrations for select using (is_admin());

-- ── settings (anon access removed in 014) ───────────────────
create policy "admin read settings"   on settings for select using (is_admin());
create policy "admin insert settings" on settings for insert with check (is_admin());
create policy "admin update settings" on settings for update using (is_admin()) with check (is_admin());

-- ── delete_ballot_votes is SECURITY DEFINER, so guard it too ─
create or replace function delete_ballot_votes(p_ballot_id uuid)
returns void
security definer
set search_path = public
language plpgsql
as $$
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;
  delete from votes where ballot_id = p_ballot_id;
end;
$$;
