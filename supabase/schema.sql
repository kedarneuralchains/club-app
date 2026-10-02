-- ============================================================
-- Toastmasters Roles — Consolidated schema (fresh-install only)
-- ============================================================
-- Run this once on a brand-new Supabase project. It produces the
-- same end state as applying migrations 001 through 009 in order.
--
-- For an existing deployment, do NOT run this file. Apply only the
-- migrations that haven't run yet from supabase/migrations/.
-- ============================================================

-- ============================================================
-- Tables
-- ============================================================

create table if not exists members (
  id              uuid primary key default gen_random_uuid(),
  membership_no   text unique not null,
  name            text not null,
  display_name    text not null,  -- first-name used in WhatsApp output, editable by admin
  active          boolean not null default true,
  deleted         boolean not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists meetings (
  id              uuid primary key default gen_random_uuid(),
  number          integer unique not null,
  date            date not null,
  start_time      time not null default '10:45:00',
  end_time        time not null default '13:00:00',
  theme           text,
  meeting_type    text not null default 'regular'
                    check (meeting_type in ('regular', 'speakathon')),
  speaker_slots   integer not null default 2,
  evaluator_slots integer not null default 2,
  created_at      timestamptz not null default now()
);

create table if not exists role_claims (
  id             uuid primary key default gen_random_uuid(),
  meeting_id     uuid not null references meetings(id) on delete cascade,
  role_key       text not null
                   check (role_key in (
                     'speaker','evaluator','tmod','ttm','ge',
                     'grammarian','ah_counter','timer','harkmaster'
                   )),
  slot_index     integer not null default 1,
  member_id      uuid not null references members(id),
  claimed_at     timestamptz not null default now(),
  admin_override boolean not null default false,
  -- Pathways speech metadata — only meaningful when role_key='speaker'
  path           text,
  speech_level   integer check (speech_level between 1 and 5),
  project        text,
  speech_title   text,
  -- Speech time allotment (minutes) for the dynamic agenda; null = level default
  speech_min_minutes integer check (speech_min_minutes between 1 and 60),
  speech_max_minutes integer check (speech_max_minutes between 1 and 60),
  approval_status    text not null default 'approved'
                       check (approval_status in ('pending', 'approved')),

  constraint role_claims_slot_unique unique (meeting_id, role_key, slot_index)
);

-- One role per member per meeting, unless admin_override
create unique index if not exists role_claims_one_per_member
  on role_claims (meeting_id, member_id)
  where not admin_override;

create table if not exists ballots (
  id                     uuid primary key default gen_random_uuid(),
  meeting_id             uuid not null references meetings(id) on delete cascade,
  status                 text not null default 'not_started'
                           check (status in ('not_started', 'open', 'closed')),
  meeting_code           text,          -- legacy field, retained for compatibility
  voter_count            integer,       -- expected turnout, auto-closes ballot
  table_topics_speakers  jsonb not null default '[]'::jsonb,
  opened_at              timestamptz,
  closed_at              timestamptz,
  created_at             timestamptz not null default now(),

  constraint ballots_meeting_unique unique (meeting_id)
);

create table if not exists votes (
  id                   uuid primary key default gen_random_uuid(),
  ballot_id            uuid not null references ballots(id) on delete cascade,
  device_uuid          text not null,
  voter_member_id      uuid references members(id),   -- self-vote guard, never exposed
  category             text not null
                         check (category in (
                           'speaker', 'evaluator', 'table_topics',
                           'role_player', 'aux_role'
                         )),
  voted_for_member_id  uuid references members(id),   -- null when voted_for is a guest
  voted_for_name       text,                          -- guest name when member_id is null
  submitted_at         timestamptz not null default now(),

  constraint votes_once_per_device_category unique (ballot_id, device_uuid, category)
);

create table if not exists guest_registrations (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid references meetings(id) on delete set null,
  name        text,
  phone       text not null,
  email       text not null,
  created_at  timestamptz not null default now()
);

create table if not exists announcements (
  id          uuid primary key default gen_random_uuid(),
  message     text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
-- The app uses Supabase's anon key for everything; the admin panel is
-- gated only by an unlisted URL + client-side password. See README's
-- "Security Model" section for the trade-offs.

alter table members             enable row level security;
alter table meetings            enable row level security;
alter table role_claims         enable row level security;
alter table ballots             enable row level security;
alter table votes               enable row level security;
alter table guest_registrations enable row level security;
alter table announcements       enable row level security;

-- Public reads
create policy "public read members"             on members             for select using (true);
create policy "public read meetings"            on meetings            for select using (true);
create policy "public read role_claims"         on role_claims         for select using (true);
create policy "public read ballots"             on ballots             for select using (true);
-- guest_registrations: no anon read — guest phone/email is admin-only via /api/admin/guests
create policy "public read announcements"       on announcements       for select using (true);
-- Note: no select policy on votes — privacy enforced at DB level.
-- Results exposed only via the get_ballot_results SECURITY DEFINER function.

-- Members
create policy "anon insert members" on members for insert with check (true);
create policy "anon update members" on members for update  using (true);

-- Meetings
create policy "anon insert meetings" on meetings for insert with check (true);
create policy "anon update meetings" on meetings for update  using (true);
create policy "anon delete meetings" on meetings for delete  using (true);

-- Role claims (app layer enforces ownership)
create policy "anon insert role_claims" on role_claims for insert with check (true);
create policy "anon update role_claims" on role_claims for update  using (true);
create policy "anon delete role_claims" on role_claims for delete  using (true);

-- Ballots
create policy "anon insert ballots" on ballots for insert with check (true);
create policy "anon update ballots" on ballots for update  using (true);

-- Votes: anon can insert only while the ballot is open
create policy "anon insert votes" on votes for insert
  with check (
    exists (
      select 1 from ballots
      where id = ballot_id and status = 'open'
    )
  );

-- Guest registrations
create policy "anon insert guest_registrations" on guest_registrations for insert with check (true);

-- Announcements
create policy "anon insert announcements" on announcements for insert with check (true);
create policy "anon update announcements" on announcements for update  using (true);
create policy "anon delete announcements" on announcements for delete  using (true);

-- ============================================================
-- Functions (SECURITY DEFINER bypasses RLS for aggregates + admin actions)
-- ============================================================

-- Has this device already voted on this ballot?
create or replace function has_voted(p_ballot_id uuid, p_device_uuid text)
returns boolean
security definer
language sql stable
as $$
  select exists (
    select 1 from votes
    where ballot_id = p_ballot_id
      and device_uuid = p_device_uuid
  );
$$;

-- Live count of distinct devices that have submitted votes
create or replace function get_vote_count(p_ballot_id uuid)
returns bigint
security definer
language sql stable
as $$
  select count(distinct device_uuid)
  from votes
  where ballot_id = p_ballot_id;
$$;

-- Aggregated results — voter identity never exposed
create or replace function get_ballot_results(p_ballot_id uuid)
returns table (
  category               text,
  voted_for_member_id    uuid,
  voted_for_display_name text,
  vote_count             bigint
)
security definer
language sql stable
as $$
  select
    v.category,
    v.voted_for_member_id,
    coalesce(m.display_name, v.voted_for_name, 'Unknown') as voted_for_display_name,
    count(*) as vote_count
  from votes v
  left join members m on m.id = v.voted_for_member_id
  where v.ballot_id = p_ballot_id
  group by v.category, v.voted_for_member_id, v.voted_for_name, m.display_name
  order by v.category, count(*) desc;
$$;

-- Admin reset: anon has no DELETE on votes, so go through a definer fn
create or replace function delete_ballot_votes(p_ballot_id uuid)
returns void
security definer
language sql
as $$
  delete from votes where ballot_id = p_ballot_id;
$$;

-- ============================================================
-- Realtime
-- ============================================================

alter publication supabase_realtime add table role_claims;
alter publication supabase_realtime add table ballots;
alter publication supabase_realtime add table votes;

-- ============================================================
-- Settings Table
-- ============================================================

create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table settings enable row level security;
-- No anon policies: settings hold secrets (Resend key); admin uses /api/admin/settings

-- ============================================================
-- Admin via Supabase Auth (migration 015)
-- After setup: create the Auth user, then
--   insert into admins (email) values ('you@example.com');
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

-- ============================================================
-- Role claim ownership (migration 016): member writes go through
-- claim_role / release_role / update_speech_details
-- ============================================================

create table if not exists role_claim_devices (
  claim_id    uuid primary key references role_claims(id) on delete cascade,
  device_uuid text not null
);
alter table role_claim_devices enable row level security;

-- Claims that existed before this migration were made without a device
-- id; mark them '*' so they stay releasable by anyone (the previous
-- behaviour) until those meetings pass. Claims with no row at all — e.g.
-- assigned by an admin — are admin-only.
insert into role_claim_devices (claim_id, device_uuid)
select id, '*' from role_claims
on conflict (claim_id) do nothing;

-- Admin, or the device that made the claim.
create or replace function can_manage_claim(p_claim_id uuid, p_device_uuid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_admin()
      or exists (
           select 1 from role_claim_devices
           where claim_id = p_claim_id
             and device_uuid in (p_device_uuid, '*')
         );
$$;

create or replace function claim_role(
  p_meeting_id     uuid,
  p_role_key       text,
  p_slot_index     integer,
  p_member_id      uuid,
  p_device_uuid    text,
  p_admin_override boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if coalesce(length(p_device_uuid), 0) < 8 then
    raise exception 'device id required';
  end if;

  insert into role_claims (meeting_id, role_key, slot_index, member_id, admin_override, approval_status)
  values (
    p_meeting_id, p_role_key, p_slot_index, p_member_id, p_admin_override,
    -- Speakers wait for VPEd approval; only an admin can skip that.
    case when p_role_key = 'speaker' and not is_admin() then 'pending' else 'approved' end
  )
  returning id into v_id;

  insert into role_claim_devices (claim_id, device_uuid) values (v_id, p_device_uuid);
  return v_id;
end;
$$;

create or replace function release_role(p_claim_id uuid, p_device_uuid text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can_manage_claim(p_claim_id, p_device_uuid) then
    raise exception 'only the member who claimed this role (on the same device) or an admin can release it';
  end if;
  delete from role_claims where id = p_claim_id;
end;
$$;

create or replace function update_speech_details(
  p_claim_id     uuid,
  p_device_uuid  text,
  p_path         text,
  p_speech_level integer,
  p_project      text,
  p_speech_title text,
  p_min_minutes  integer,
  p_max_minutes  integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can_manage_claim(p_claim_id, p_device_uuid) then
    raise exception 'only the speaker (on the same device) or an admin can edit these details';
  end if;
  update role_claims
     set path               = p_path,
         speech_level       = p_speech_level,
         project            = p_project,
         speech_title       = p_speech_title,
         speech_min_minutes = p_min_minutes,
         speech_max_minutes = p_max_minutes
   where id = p_claim_id and role_key = 'speaker';
end;
$$;

grant execute on function claim_role(uuid, text, integer, uuid, text, boolean) to anon, authenticated;
grant execute on function release_role(uuid, text) to anon, authenticated;
grant execute on function update_speech_details(uuid, text, text, integer, text, text, integer, integer) to anon, authenticated;

-- Direct table writes: admins only.
drop policy if exists "anon insert role_claims" on role_claims;
drop policy if exists "anon update role_claims" on role_claims;
drop policy if exists "anon delete role_claims" on role_claims;
create policy "admin insert role_claims" on role_claims for insert with check (is_admin());
create policy "admin update role_claims" on role_claims for update using (is_admin()) with check (is_admin());
create policy "admin delete role_claims" on role_claims for delete using (is_admin());

-- ============================================================
-- Member PINs, sessions, consent; guest retention (migration 017)
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists member_pins (
  member_id       uuid primary key references members(id) on delete cascade,
  pin_hash        text not null,
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now()
);

create table if not exists member_sessions (
  token_hash   text primary key,
  member_id    uuid not null references members(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create table if not exists member_consents (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references members(id) on delete cascade,
  terms_version text not null,
  accepted_at   timestamptz not null default now()
);

alter table member_pins     enable row level security;
alter table member_sessions enable row level security;
alter table member_consents enable row level security;
-- Only admins may read the consent log; pins and sessions are never readable.
create policy "admin read member_consents" on member_consents for select using (is_admin());

alter table guest_registrations add column if not exists terms_version text;

-- ── internal helpers (not granted to anon) ──────────────────

create or replace function session_member(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_member uuid;
begin
  if p_token is null or length(p_token) < 32 then
    return null;
  end if;
  update member_sessions
     set last_used_at = now()
   where token_hash = encode(digest(p_token, 'sha256'), 'hex')
  returning member_id into v_member;
  return v_member;
end;
$$;

create or replace function new_member_session(p_member_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := encode(gen_random_bytes(32), 'hex');
begin
  insert into member_sessions (token_hash, member_id)
  values (encode(digest(v_token, 'sha256'), 'hex'), p_member_id);
  return v_token;
end;
$$;

create or replace function latest_terms(p_member_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select terms_version from member_consents
  where member_id = p_member_id
  order by accepted_at desc
  limit 1;
$$;

revoke execute on function session_member(text)     from public, anon, authenticated;
revoke execute on function new_member_session(uuid) from public, anon, authenticated;
revoke execute on function latest_terms(uuid)        from public, anon, authenticated;

-- ── public sign-in API ───────────────────────────────────────

-- Tells the sign-in screen whether to ask "set a PIN" or "enter PIN",
-- and whether the terms need (re-)accepting.
create or replace function member_pin_status(p_member_id uuid, p_terms_version text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'has_pin',     exists (select 1 from member_pins where member_id = p_member_id),
    'needs_terms', coalesce(latest_terms(p_member_id), '') <> p_terms_version
  );
$$;

create or replace function set_member_pin(p_member_id uuid, p_pin text, p_terms_version text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be 4 digits';
  end if;
  if p_pin ~ '^([0-9])\1{3}$' or p_pin in ('1234','2345','3456','4567','5678','6789','0123','9876','4321') then
    raise exception 'PIN is too easy to guess — pick another';
  end if;
  if coalesce(p_terms_version, '') = '' then
    raise exception 'terms must be accepted';
  end if;
  if not exists (select 1 from members where id = p_member_id and not deleted) then
    raise exception 'unknown member';
  end if;
  if exists (select 1 from member_pins where member_id = p_member_id) then
    raise exception 'A PIN is already set for this member. Ask an admin to reset it if you forgot it.';
  end if;

  insert into member_pins (member_id, pin_hash) values (p_member_id, crypt(p_pin, gen_salt('bf')));
  insert into member_consents (member_id, terms_version) values (p_member_id, p_terms_version);
  return new_member_session(p_member_id);
end;
$$;

-- p_terms_version: pass it when the member ticked the terms box on this
-- sign-in (first time on a new version); null otherwise.
create or replace function member_login(p_member_id uuid, p_pin text, p_terms_version text default null)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r member_pins%rowtype;
begin
  select * into r from member_pins where member_id = p_member_id for update;
  if not found then
    raise exception 'No PIN set yet';
  end if;
  if r.locked_until is not null and r.locked_until > now() then
    raise exception 'Too many wrong PINs. Try again after %', to_char(r.locked_until at time zone 'Asia/Kolkata', 'HH12:MI AM');
  end if;

  if r.pin_hash <> crypt(coalesce(p_pin, ''), r.pin_hash) then
    update member_pins
       set failed_attempts = case when r.failed_attempts + 1 >= 5 then 0 else r.failed_attempts + 1 end,
           locked_until    = case when r.failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
     where member_id = p_member_id;
    -- RAISE would roll back the counter update, so report failure as null.
    return null;
  end if;

  update member_pins set failed_attempts = 0, locked_until = null where member_id = p_member_id;
  if p_terms_version is not null then
    insert into member_consents (member_id, terms_version) values (p_member_id, p_terms_version);
  end if;
  return new_member_session(p_member_id);
end;
$$;

-- Validates a stored token on app load. Returns null when the session is
-- gone (signed out, PIN reset by admin).
create or replace function check_member_session(p_token text, p_terms_version text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid := session_member(p_token);
begin
  if v_member is null then
    return null;
  end if;
  return json_build_object(
    'member_id',   v_member,
    'needs_terms', coalesce(latest_terms(v_member), '') <> p_terms_version
  );
end;
$$;

create or replace function member_logout(p_token text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from member_sessions where token_hash = encode(digest(p_token, 'sha256'), 'hex');
$$;

create or replace function admin_reset_pin(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;
  delete from member_pins     where member_id = p_member_id;
  delete from member_sessions where member_id = p_member_id;
end;
$$;

-- For the admin Members tab: which members have set a PIN.
create or replace function admin_members_with_pin()
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;
  return coalesce((select array_agg(member_id) from member_pins), '{}');
end;
$$;

grant execute on function member_pin_status(uuid, text)          to anon, authenticated;
grant execute on function set_member_pin(uuid, text, text)       to anon, authenticated;
grant execute on function member_login(uuid, text, text)         to anon, authenticated;
grant execute on function check_member_session(text, text)       to anon, authenticated;
grant execute on function member_logout(text)                    to anon, authenticated;
grant execute on function admin_reset_pin(uuid)                  to authenticated;
grant execute on function admin_members_with_pin()               to authenticated;

-- ── role claims: member-based instead of device-based ───────

drop function if exists claim_role(uuid, text, integer, uuid, text, boolean);
drop function if exists release_role(uuid, text);
drop function if exists update_speech_details(uuid, text, text, integer, text, text, integer, integer);
drop function if exists can_manage_claim(uuid, text);

-- Admin, the member who holds the claim, or a pre-016 claim ('*').
create or replace function can_manage_claim(p_claim_id uuid, p_token text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select is_admin()
      or exists (select 1 from role_claim_devices where claim_id = p_claim_id and device_uuid = '*')
      or exists (select 1 from role_claims where id = p_claim_id and member_id = session_member(p_token));
$$;
revoke execute on function can_manage_claim(uuid, text) from public, anon, authenticated;

create or replace function claim_role(
  p_meeting_id     uuid,
  p_role_key       text,
  p_slot_index     integer,
  p_token          text,
  p_admin_override boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid := session_member(p_token);
  v_id     uuid;
begin
  if v_member is null then
    raise exception 'Please sign in again with your PIN';
  end if;

  insert into role_claims (meeting_id, role_key, slot_index, member_id, admin_override, approval_status)
  values (
    p_meeting_id, p_role_key, p_slot_index, v_member, p_admin_override,
    case when p_role_key = 'speaker' then 'pending' else 'approved' end
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function release_role(p_claim_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can_manage_claim(p_claim_id, p_token) then
    raise exception 'Only the member who holds this role or an admin can release it';
  end if;
  delete from role_claims where id = p_claim_id;
end;
$$;

create or replace function update_speech_details(
  p_claim_id     uuid,
  p_token        text,
  p_path         text,
  p_speech_level integer,
  p_project      text,
  p_speech_title text,
  p_min_minutes  integer,
  p_max_minutes  integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can_manage_claim(p_claim_id, p_token) then
    raise exception 'Only the speaker or an admin can edit these details';
  end if;
  update role_claims
     set path               = p_path,
         speech_level       = p_speech_level,
         project            = p_project,
         speech_title       = p_speech_title,
         speech_min_minutes = p_min_minutes,
         speech_max_minutes = p_max_minutes
   where id = p_claim_id and role_key = 'speaker';
end;
$$;

grant execute on function claim_role(uuid, text, integer, text, boolean) to anon, authenticated;
grant execute on function release_role(uuid, text) to anon, authenticated;
grant execute on function update_speech_details(uuid, text, text, integer, text, text, integer, integer) to anon, authenticated;

-- ── guest data retention: delete after 6 months ─────────────

create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'purge-old-guest-registrations';
select cron.schedule(
  'purge-old-guest-registrations',
  '30 20 * * *',  -- daily, 02:00 IST
  $$delete from public.guest_registrations where created_at < now() - interval '6 months'$$
);

-- ============================================================
-- Change PIN (migration 018)
-- ============================================================

-- Shared PIN rules (null = OK).
create or replace function pin_problem(p_pin text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_pin, '') !~ '^[0-9]{4}$' then 'PIN must be 4 digits'
    when p_pin ~ '^([0-9])\1{3}$'
      or p_pin in ('1234','2345','3456','4567','5678','6789','0123','9876','4321')
      then 'PIN is too easy to guess — pick another'
  end;
$$;

create or replace function change_member_pin(p_token text, p_current_pin text, p_new_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_member  uuid := session_member(p_token);
  v_problem text := pin_problem(p_new_pin);
  r         member_pins%rowtype;
begin
  if v_member is null then
    raise exception 'Please sign in again with your PIN';
  end if;
  if v_problem is not null then
    raise exception '%', v_problem;
  end if;

  select * into r from member_pins where member_id = v_member for update;
  if not found then
    raise exception 'No PIN set yet';
  end if;
  if r.locked_until is not null and r.locked_until > now() then
    raise exception 'Too many wrong PINs. Try again after %', to_char(r.locked_until at time zone 'Asia/Kolkata', 'HH12:MI AM');
  end if;

  if r.pin_hash <> crypt(coalesce(p_current_pin, ''), r.pin_hash) then
    update member_pins
       set failed_attempts = case when r.failed_attempts + 1 >= 5 then 0 else r.failed_attempts + 1 end,
           locked_until    = case when r.failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
     where member_id = v_member;
    return false;
  end if;

  update member_pins
     set pin_hash = crypt(p_new_pin, gen_salt('bf')),
         failed_attempts = 0,
         locked_until = null,
         updated_at = now()
   where member_id = v_member;

  delete from member_sessions
   where member_id = v_member
     and token_hash <> encode(digest(p_token, 'sha256'), 'hex');
  return true;
end;
$$;

grant execute on function change_member_pin(text, text, text) to anon, authenticated;
