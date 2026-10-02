-- ============================================================
-- Toastmasters Roles — Migration 016: Role claim ownership
-- ============================================================
-- role_claims was fully writable by anon: anyone holding the public
-- key could release other members' roles, edit their speech details,
-- or approve their own speaker slot.
--
-- Members still don't log in, so ownership is tied to the device that
-- made the claim (the tm_device_uuid already used for voting). The
-- device id is kept in a separate table with no read policy — role_claims
-- itself stays publicly readable.
--
-- Member writes now go through SECURITY DEFINER functions:
--   claim_role, release_role, update_speech_details
-- Admins (is_admin(), migration 015) keep direct table access, which
-- covers assigning, approving and releasing any claim.
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
