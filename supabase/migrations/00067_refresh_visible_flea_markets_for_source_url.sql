-- Refresh visible_flea_markets so source_url projects through.
--
-- 00064 added flea_markets.source_url but did not refresh the view. Postgres
-- freezes a `select fm.*` view's column list at creation time, so the column
-- landed on the table and never reached the view: flea_markets had 30 columns,
-- visible_flea_markets 29. Anything reading provenance through the view — the
-- import core's dedup step, /admin/markets, the city hubs — would have seen a
-- table without the column and failed or silently dropped it.
--
-- Same failure mode as when `slug` landed and the view kept returning the
-- pre-slug shape, which broke /loppis/[slug]. That incident is why
-- scripts/check-view-refreshes.mjs exists; it caught this one in CI.
--
-- create or replace preserves existing grants, and the view carries no
-- reloptions (no security_invoker), so nothing else needs restating.

create or replace view public.visible_flea_markets as
  select fm.*
  from public.flea_markets fm
  where public.is_market_visible(fm.id);
