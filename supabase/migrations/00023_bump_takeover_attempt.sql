-- 00023_bump_takeover_attempt.sql
-- Atomic increment for takeover verification attempts. Prevents the
-- TOCTOU race where two concurrent verify calls both pass a stale
-- count check and each get their own +1 budget.

create or replace function public.bump_takeover_attempt(
  p_token_id uuid,
  p_max_attempts int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  update public.business_owner_tokens
     set verification_attempts = verification_attempts + 1
   where id = p_token_id
     and verification_attempts < p_max_attempts
  returning verification_attempts into new_count;
  -- returns null when the row was already at or above the cap
  return new_count;
end;
$$;

revoke all on function public.bump_takeover_attempt(uuid, int) from public;
grant execute on function public.bump_takeover_attempt(uuid, int) to service_role;
