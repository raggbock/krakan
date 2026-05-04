-- Pre-warm Cloudflare edge cache for ISR-enabled public pages.
-- Runs every 30 minutes — keeps the top 200 listings hot so the revalidate
-- window never expires under real-user traffic.
--
-- Prerequisites:
--   • pg_cron — scheduled jobs (verified in 00002 cancel-expired-bookings)
--   • pg_net  — outbound HTTP from inside Postgres
--   • Vault secret `service_role_key` containing the project's service role JWT.
--     Create once via:
--       select vault.create_secret('<service-role-key>', 'service_role_key');
--
-- Vault is preferred over `alter database … set app.settings.…` because the
-- service role key is encrypted at rest and not exposed via pg_settings logs.

select cron.schedule(
  'cache_warmup_30min',
  '*/30 * * * *',
  $$ select net.http_post(
    url     := 'https://yqeegfhwbjnlrdurstxp.supabase.co/functions/v1/cache-warmup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
    )
  ); $$
);
