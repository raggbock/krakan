-- RLS on notification_deliveries (set in 00053) allows SELECT for owner
-- but UPDATE is service_role only — by design, so users can't change
-- delivery status / sent_at. But marking a row as read IS a user action.
--
-- Expose two SECURITY DEFINER RPCs that only touch read_at, scoped to
-- the caller's own rows via auth.uid(). The p_user_id param is for
-- defence in depth (must equal auth.uid()) and to keep the rpc call
-- shape symmetric with the adapter API; it cannot be used to update
-- another user's rows.

create or replace function public.mark_notification_read(p_user_id uuid, p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.notification_deliveries
    set read_at = now()
    where user_id = auth.uid()
      and event_id = p_event_id
      and channel = 'inbox'
      and read_at is null;
end;
$$;

create or replace function public.mark_all_notifications_read(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with updated as (
    update public.notification_deliveries
      set read_at = now()
      where user_id = auth.uid()
        and channel = 'inbox'
        and read_at is null
      returning 1
  )
  select count(*) into v_count from updated;
  return v_count;
end;
$$;

revoke all on function public.mark_notification_read(uuid, uuid) from public;
revoke all on function public.mark_all_notifications_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid, uuid) to authenticated;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated;
