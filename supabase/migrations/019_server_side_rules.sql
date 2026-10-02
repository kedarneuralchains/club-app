-- ============================================================
-- Toastmasters Roles — Migration 019: Enforce rules in the database
-- ============================================================
-- 1. Votes go through submit_votes(): members must be signed in (PIN
--    session) and can vote once per ballot regardless of device; the
--    voter-count cap is checked server-side. Guests still vote without
--    a PIN (one ballot per browser).
-- 2. claim_role / release_role / update_speech_details enforce the
--    meeting lock and the role-pairing + rotation rules that used to
--    live only in the browser (lib/utils.ts). Admins bypass them by
--    writing to the table directly, as before.
-- 3. Membership numbers are no longer readable with the public key.
-- 4. role_claims.vped_notified_at lets /api/notify-vped send at most one
--    email per speaker claim.
-- ============================================================

-- ── 1. votes ─────────────────────────────────────────────────

drop policy if exists "anon insert votes" on votes;

-- One vote per member per category per ballot, whatever the device.
create unique index if not exists votes_once_per_member_category
  on votes (ballot_id, voter_member_id, category)
  where voter_member_id is not null;

-- p_votes: [{ "category": "speaker", "member_id": "<uuid>" | null, "name": "<guest>" | null }, ...]
-- p_token: member session token, or null for a guest.
-- Returns 'ok' | 'already_voted' | 'full'.
create or replace function submit_votes(
  p_ballot_id   uuid,
  p_device_uuid text,
  p_token       text,
  p_votes       jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid;
  b        ballots%rowtype;
begin
  select * into b from ballots where id = p_ballot_id for update;
  if not found or b.status <> 'open' then
    raise exception 'Voting is not open';
  end if;
  if coalesce(length(p_device_uuid), 0) < 8 then
    raise exception 'device id required';
  end if;

  if p_token is not null then
    v_member := session_member(p_token);
    if v_member is null then
      raise exception 'Please sign in again with your PIN';
    end if;
    if exists (select 1 from votes where ballot_id = p_ballot_id and voter_member_id = v_member) then
      return 'already_voted';
    end if;
  end if;

  if exists (select 1 from votes where ballot_id = p_ballot_id and device_uuid = p_device_uuid) then
    return 'already_voted';
  end if;

  if b.voter_count is not null
     and (select count(distinct device_uuid) from votes where ballot_id = p_ballot_id) >= b.voter_count then
    return 'full';
  end if;

  insert into votes (ballot_id, device_uuid, voter_member_id, category, voted_for_member_id, voted_for_name)
  select p_ballot_id, p_device_uuid, v_member,
         v ->> 'category',
         nullif(v ->> 'member_id', '')::uuid,
         nullif(v ->> 'name', '')
  from jsonb_array_elements(p_votes) as v;

  return 'ok';
end;
$$;

grant execute on function submit_votes(uuid, text, text, jsonb) to anon, authenticated;

-- ── 2. role rules ────────────────────────────────────────────

-- Roles lock at the meeting's start time (IST) on the meeting day.
create or replace function meeting_locked(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select now() >= ((date + start_time) at time zone 'Asia/Kolkata')
  from meetings where id = p_meeting_id;
$$;

-- Meetings count as past from 2 PM IST on the meeting day.
create or replace function meeting_past(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select now() >= ((date + time '14:00') at time zone 'Asia/Kolkata')
  from meetings where id = p_meeting_id;
$$;

-- Mirrors roleClaimBlocked + consecutiveRoleBlocked in lib/utils.ts.
-- Returns the reason a member can't take the role, or null.
create or replace function role_claim_problem(p_meeting_id uuid, p_member_id uuid, p_role_key text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_existing text[];
  v_adjacent text[];
  v_number   integer;
  v_tag      text[] := array['grammarian', 'ah_counter', 'timer', 'harkmaster'];
begin
  select coalesce(array_agg(role_key), '{}') into v_existing
  from role_claims where meeting_id = p_meeting_id and member_id = p_member_id;

  if cardinality(v_existing) > 0 then
    if 'tmod' = any(v_existing) then return 'TMoD cannot take other roles'; end if;
    if p_role_key = 'tmod' then return 'TMoD must be the only role'; end if;
    if cardinality(v_existing) >= 3 then return 'Max 3 roles per meeting'; end if;
    if p_role_key = 'speaker' and 'speaker' = any(v_existing) then return 'Cannot take two speaker slots'; end if;
    if p_role_key = any(v_tag) and v_existing && v_tag then return 'Only one auxiliary role per member'; end if;
  end if;

  -- Rotation: not the same role in the meeting just before or after
  -- (by number). Evaluator is exempt.
  if p_role_key <> 'evaluator' then
    select number into v_number from meetings where id = p_meeting_id;
    select coalesce(array_agg(rc.role_key), '{}') into v_adjacent
    from role_claims rc
    join meetings m on m.id = rc.meeting_id
    where rc.member_id = p_member_id
      and m.id in (
        (select id from meetings where number < v_number order by number desc limit 1),
        (select id from meetings where number > v_number order by number asc  limit 1)
      );
    if p_role_key = any(v_adjacent) then return 'Same role back-to-back'; end if;
  end if;

  return null;
end;
$$;

revoke execute on function role_claim_problem(uuid, uuid, text) from public, anon, authenticated;

drop function if exists claim_role(uuid, text, integer, text, boolean);

create or replace function claim_role(
  p_meeting_id uuid,
  p_role_key   text,
  p_slot_index integer,
  p_token      text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member  uuid := session_member(p_token);
  v_problem text;
  v_id      uuid;
begin
  if v_member is null then
    raise exception 'Please sign in again with your PIN';
  end if;
  if coalesce(meeting_locked(p_meeting_id), true) then
    raise exception 'Roles are locked for this meeting';
  end if;

  v_problem := role_claim_problem(p_meeting_id, v_member, p_role_key);
  if v_problem is not null then
    raise exception '%', v_problem;
  end if;

  insert into role_claims (meeting_id, role_key, slot_index, member_id, admin_override, approval_status)
  values (
    p_meeting_id, p_role_key, p_slot_index, v_member,
    -- A second/third role needs admin_override to pass the one-role index;
    -- the pairing rules above already decided it's allowed.
    exists (select 1 from role_claims where meeting_id = p_meeting_id and member_id = v_member),
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
  if not is_admin()
     and coalesce(meeting_locked((select meeting_id from role_claims where id = p_claim_id)), true) then
    raise exception 'Roles are locked for this meeting — ask the VPEd';
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
  -- Speakers may finalise details after the lock, until the meeting is past.
  if not is_admin()
     and coalesce(meeting_past((select meeting_id from role_claims where id = p_claim_id)), true) then
    raise exception 'This meeting is over — ask the VPEd to change speech details';
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

grant execute on function claim_role(uuid, text, integer, text) to anon, authenticated;

-- ── 3. hide membership numbers from the public key ───────────

revoke select on members from anon;
grant select (id, name, display_name, active, deleted, created_at) on members to anon;

-- ── 4. one VPEd email per speaker claim ──────────────────────

alter table role_claims add column if not exists vped_notified_at timestamptz;
