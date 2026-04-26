-- Atomic admin-invite acceptance. The previous flow had a TOCTOU window
-- between the "is this invite still valid" check and the writes, plus
-- it silently discarded the UPDATE result on admin_invites.accepted_at,
-- leaving the invite reusable if that write transiently failed.
--
-- This RPC bundles the validation + admin_users upsert + invite-mark
-- + audit insert into one transaction. Returns the granted user_id on
-- success. Raises typed errors that the edge function maps to HTTP
-- status codes.

create or replace function public.accept_admin_invite(
  p_token_hash text,
  p_user_id uuid,
  p_user_email text,
  p_client_ip text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_id uuid;
  v_invite_email text;
  v_invited_by uuid;
  v_expires_at timestamptz;
  v_revoked_at timestamptz;
  v_accepted_at timestamptz;
begin
  select id, email, invited_by, expires_at, revoked_at, accepted_at
    into v_invite_id, v_invite_email, v_invited_by, v_expires_at, v_revoked_at, v_accepted_at
  from admin_invites
  where token_hash = p_token_hash
  for update;

  if v_invite_id is null then
    raise exception 'invite_not_found' using errcode = 'P0001';
  end if;
  if v_revoked_at is not null then
    raise exception 'invite_revoked' using errcode = 'P0001';
  end if;
  if v_accepted_at is not null then
    raise exception 'invite_already_accepted' using errcode = 'P0001';
  end if;
  if v_expires_at < now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;
  if v_invite_email <> p_user_email then
    raise exception 'invite_email_mismatch' using errcode = 'P0001';
  end if;

  insert into admin_users (user_id, granted_at, granted_by, revoked_at)
  values (p_user_id, now(), v_invited_by, null)
  on conflict (user_id) do update
    set granted_at = excluded.granted_at,
        granted_by = excluded.granted_by,
        revoked_at = null;

  update admin_invites
    set accepted_at = now(),
        accepted_by = p_user_id,
        accepted_from_ip = p_client_ip
    where id = v_invite_id;

  insert into admin_actions (admin_user_id, action, target_type, target_id, payload)
  values (p_user_id, 'admin.invite.accepted', 'admin_user', p_user_id::text, jsonb_build_object('inviteId', v_invite_id));

  return p_user_id;
end;
$$;

grant execute on function public.accept_admin_invite(text, uuid, text, text) to service_role;

comment on function public.accept_admin_invite(text, uuid, text, text) is
  'Atomic admin-invite acceptance: validates invite + grants admin role + marks invite + writes audit, all in one tx. Replaces the previous procedural sequence that had a TOCTOU window.';
