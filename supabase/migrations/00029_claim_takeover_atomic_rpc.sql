-- Atomic takeover claim. Spends the token AND transfers ownership in
-- one transaction so the half-applied state we hit on 2026-04-26
-- (token spent, ownership not transferred) is impossible.
--
-- Caller must already have:
--   * Verified the user-supplied 6-digit code matches verification_code_hash
--   * Bumped the attempt counter via bump_takeover_attempt()
--   * Resolved or created the auth.users row for the email
--
-- Returns the flea_market_id on success. Raises 'token_already_used'
-- if the token is gone — caller maps that to HTTP 410.

create or replace function public.claim_takeover_atomic(
  p_token_hash text,
  p_user_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market_id uuid;
begin
  update business_owner_tokens
  set used_at = now()
  where token_hash = p_token_hash
    and used_at is null
    and invalidated_at is null
    and expires_at > now()
  returning flea_market_id into v_market_id;

  if v_market_id is null then
    raise exception 'token_already_used' using errcode = 'P0001';
  end if;

  update flea_markets
  set organizer_id = p_user_id,
      is_system_owned = false
  where id = v_market_id;

  return v_market_id;
end;
$$;

grant execute on function public.claim_takeover_atomic(text, uuid) to service_role;

comment on function public.claim_takeover_atomic(text, uuid) is
  'Atomic takeover finalize: spend token + transfer ownership in one tx. '
  'Caller must verify the 6-digit code separately and resolve the user id first.';
