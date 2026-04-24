-- 00026_admin_user_emails_rpc.sql
-- Migration 00024 revoked auth_user_email_view from authenticated, which
-- broke the listAdmins() flow on /admin/settings/admins (it queries the
-- view via the user's session). Restore admin functionality without
-- exposing the view to all authenticated users via a security-definer
-- RPC that gates on is_admin(auth.uid()).

create or replace function public.admin_user_emails(user_ids uuid[])
returns table(id uuid, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    -- Not an admin — return empty set, never raise (avoids leaking
    -- whether an id existed in the view).
    return;
  end if;
  return query
    select v.id, v.email::text
    from public.auth_user_email_view v
    where v.id = any(user_ids);
end;
$$;

revoke execute on function public.admin_user_emails(uuid[]) from public, anon;
grant execute on function public.admin_user_emails(uuid[]) to authenticated, service_role;
