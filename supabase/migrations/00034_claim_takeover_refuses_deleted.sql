-- Refuse takeover claims on soft-deleted markets.
--
-- Edge case from the security review: if an admin generated a takeover
-- token before the market was removed (via remove_via_takeover or any
-- direct is_deleted=true update), the token would still pass the
-- expiry/validity gates and leave the user "owning" a market they can't
-- see in the listing. Better to fail loud — the token has been
-- spent before the deleted-check, so this also closes the door on
-- replays once a market is removed.

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
  v_is_deleted boolean;
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

  select is_deleted into v_is_deleted
  from flea_markets
  where id = v_market_id;

  if v_is_deleted then
    raise exception 'market_deleted' using errcode = 'P0001';
  end if;

  update flea_markets
  set organizer_id = p_user_id,
      is_system_owned = false
  where id = v_market_id;

  return v_market_id;
end;
$$;

comment on function public.claim_takeover_atomic(text, uuid) is
  'Atomic takeover finalize: spend token + transfer ownership in one tx. '
  'Raises market_deleted if the underlying market has been soft-deleted '
  'between token issuance and claim.';
