-- ============================================================
-- Toastmasters Roles — Migration 018: Members can change their PIN
-- ============================================================
-- change_member_pin(token, current PIN, new PIN):
--   * the current PIN must be right — wrong guesses count towards the
--     same 5-tries / 15-minute lock as sign-in
--   * the new PIN follows the same rules as set_member_pin
--   * other sessions of the member are signed out; this one stays
-- Returns true on success, false when the current PIN is wrong (a
-- RAISE would roll back the failed-attempt counter).
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
