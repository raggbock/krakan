-- Atomic owner-initiated removal via takeover token.
-- Used when an organizer clicks "Ta bort sidan" on the takeover landing page.
-- Soft-deletes the flea market AND invalidates ALL outstanding takeover
-- tokens for that market in one transaction so a token can never be
-- reused after removal.
--
-- Caller must have verified the supplied token belongs to a real,
-- still-valid token row. The RPC re-checks the token under a row lock to
-- close any TOCTOU window where two concurrent requests could both
-- attempt removal.
--
-- Returns the flea_market_id on success. Raises 'token_already_used'
-- if the token is gone — caller maps that to HTTP 410.

create or replace function public.remove_via_takeover(
  p_token_hash text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market_id uuid;
begin
  -- Spend the token (mark invalidated, not used — used_at is reserved for
  -- successful claims). This locks the row.
  update business_owner_tokens
  set invalidated_at = now()
  where token_hash = p_token_hash
    and used_at is null
    and invalidated_at is null
    and expires_at > now()
  returning flea_market_id into v_market_id;

  if v_market_id is null then
    raise exception 'token_already_used' using errcode = 'P0001';
  end if;

  -- Invalidate any other outstanding tokens for this market. If multiple
  -- invites went out (e.g. admin reissued), removal closes them all.
  update business_owner_tokens
  set invalidated_at = now()
  where flea_market_id = v_market_id
    and used_at is null
    and invalidated_at is null;

  -- Soft-delete the market. is_market_visible() filters on is_deleted, so
  -- this hides the listing from public listings, search, and map.
  update flea_markets
  set is_deleted = true
  where id = v_market_id;

  return v_market_id;
end;
$$;

grant execute on function public.remove_via_takeover(text) to service_role;

comment on function public.remove_via_takeover(text) is
  'Atomic owner-initiated removal via takeover token: invalidates the '
  'token (and any siblings for the same market) and soft-deletes the '
  'flea market in one transaction.';
