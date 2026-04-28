-- Cache the Google Place ID per market.
--
-- Google Maps Platform ToS allows permanent storage of place_id and
-- coordinates, even if other fields (opening hours etc) are required to
-- be re-fetched within 30 days. Storing the place_id lets us refresh
-- those volatile fields cheaply later instead of paying for a Text
-- Search hit each time.
--
-- Refresh visible_flea_markets so the new column projects through (the
-- view's column list is frozen at creation time — see CI check
-- check-view-refreshes.mjs).

alter table public.flea_markets
  add column google_place_id text;

create unique index flea_markets_google_place_id_idx
  on public.flea_markets (google_place_id)
  where google_place_id is not null;

create or replace view public.visible_flea_markets as
  select fm.*
  from public.flea_markets fm
  where public.is_market_visible(fm.id);
