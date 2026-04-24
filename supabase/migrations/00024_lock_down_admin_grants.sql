-- 00024_lock_down_admin_grants.sql
-- Tighten grants on the admin RPC and the email-lookup view.

-- (S3) The view is only consumed by service-role edge functions.
revoke select on public.auth_user_email_view from anon, authenticated;
grant select on public.auth_user_email_view to service_role;

-- (S2) is_admin(uuid) was callable by any authenticated user with any
-- arbitrary uid — letting them enumerate which UUIDs are admins. Lock
-- the function so authenticated callers can only check their own uid;
-- service-role keeps full access for edge functions.
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and uid != auth.uid() then
    return false;
  end if;
  return exists(select 1 from public.admin_users
                where user_id = uid and revoked_at is null);
end;
$$;

revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated, service_role;
