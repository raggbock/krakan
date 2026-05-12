-- 30-day retention cron for notification tables.
--
-- A SECURITY DEFINER function performs the two-step cascading delete:
--   1. Remove notification_deliveries older than 30 days.
--   2. Remove notification_events that have no remaining deliveries and are
--      older than 30 days (orphan cleanup — protects events that still have
--      pending/sent deliveries from being deleted prematurely).
--
-- The cron job runs at 02:00 UTC daily.
-- Europe/Stockholm offset note (mirrors 00057_digest_cron.sql):
--   02:00 UTC = 04:00 CEST (summer) / 03:00 CET (winter)
-- Running at 02:00 UTC keeps the job well before the 04:00 UTC digest run
-- so the digest never operates on stale rows that should already be gone.

create or replace function public.purge_old_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Step 1: delete delivery rows older than 30 days
  delete from notification_deliveries
  where created_at < now() - interval '30 days';

  -- Step 2: delete event rows that have no remaining deliveries
  --         AND are themselves older than 30 days
  delete from notification_events
  where occurred_at < now() - interval '30 days'
    and id not in (
      select event_id from notification_deliveries
    );
end;
$$;

-- Only postgres/service_role needs to call this — it's invoked by pg_cron.
-- No grant to anon or authenticated is needed.

select cron.schedule(
  'notification-retention',
  '0 2 * * *',
  $$ select public.purge_old_notifications(); $$
);
