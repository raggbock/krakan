-- pg_cron job: fire notification-digest edge function daily at 06:00 Europe/Stockholm.
--
-- Supabase's hosted pg_cron version does NOT support the 4-argument timezone
-- overload of cron.schedule(name, schedule, timezone, command).
-- We therefore use a fixed UTC time as a reasonable approximation:
--
--   Europe/Stockholm = UTC+2 (CEST, ~late Mar–late Oct)
--                    = UTC+1 (CET,  ~late Oct–late Mar)
--
-- 04:00 UTC = 06:00 CEST (exact in summer) = 05:00 CET (1 hour early in winter).
-- This is intentional — better to send slightly early in winter than to
-- miss the "morning" window. Update the cron expression to '0 5 * * *' in
-- late October if strict 06:00 local delivery is needed year-round.
--
-- Prerequisite: Vault secret `service_role_key` must exist (see migration 00049
-- and SETUP-CHECKLIST for the one-time setup command).

select cron.schedule(
  'notification-digest',
  '0 4 * * *',
  $$ select net.http_post(
    url     := 'https://yqeegfhwbjnlrdurstxp.supabase.co/functions/v1/notification-digest',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
    )
  ); $$
);
