-- Pre-warm Cloudflare edge cache for ISR-enabled public pages.
-- Runs every 30 minutes — keeps the top 200 listings hot so the revalidate
-- window never expires under real-user traffic.
--
-- Prerequisites (both already present on this project):
--   • pg_cron   — verified in migration 00002 (cancel-expired-bookings)
--   • pg_net    — required for net.http_post outbound calls
--
-- If pg_net is not yet enabled, enable it via the Supabase dashboard →
-- Database → Extensions, then re-run this migration.
--
-- The `app.settings.functions_url` and `app.settings.service_role_key`
-- settings are set in the Supabase dashboard → Settings → Database → Custom
-- config, or via the CLI:
--   supabase secrets set --env-file .env
-- They must be populated before the cron job fires, otherwise the call will
-- fail silently (pg_cron swallows errors from failed SQL commands).
--
-- Verification after applying:
--   select jobid, jobname, schedule from cron.job where jobname = 'cache_warmup_30min';

select cron.schedule(
  'cache_warmup_30min',
  '*/30 * * * *',
  $$ select net.http_post(
    url     := current_setting('app.settings.functions_url') || '/cache-warmup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  ); $$
);
