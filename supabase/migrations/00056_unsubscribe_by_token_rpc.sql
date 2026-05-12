-- unsubscribe_by_token — SECURITY DEFINER RPC that sets email_digest_enabled = false
-- for the user matching the provided token.
--
-- Bypasses RLS so unauthenticated users can call it with just their token.
-- Grants execute to `anon` so the /unsubscribe page (no auth required) can call it.
-- Returns true if a matching row was found and updated; false if the token is unknown.

create or replace function public.unsubscribe_by_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows_updated int;
begin
  update public.user_notification_prefs
  set email_digest_enabled = false
  where unsubscribe_token = p_token
    and email_digest_enabled = true;  -- idempotent: no-op if already disabled

  get diagnostics v_rows_updated = row_count;
  return v_rows_updated > 0;
end;
$$;

-- Allow the anon role (unauthenticated requests) to call this RPC.
grant execute on function public.unsubscribe_by_token(text) to anon;
