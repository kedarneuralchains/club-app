-- ============================================================
-- Toastmasters Roles — Migration 017: Member PINs + consent
-- ============================================================
-- Members sign in with their name + a 4-digit PIN (set by the member on
-- first sign-in, resettable by an admin) and accept the terms. A sign-in
-- creates a session token kept in the browser; role claims are tied to
-- the MEMBER (not the device), so they can be managed from any device
-- and nobody can claim a role in someone else's name.
--
-- PINs are stored as bcrypt hashes; 5 wrong tries lock the member for
-- 15 minutes. Session tokens are stored as SHA-256 hashes.
--
-- Replaces the device-based functions from 016. Claims made before 016
-- (marked '*') keep the old open behaviour until those meetings pass.
--
-- Also: guest registrations record which terms version was accepted, and
-- guest records older than 6 months are deleted daily (pg_cron).
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
