-- Migration: visible_flea_markets view
--
-- A convenience view that pre-filters to only publicly-visible markets.
-- Used by the Supabase client list() adapter and server-data helpers to
-- avoid repeating the is_market_visible() call at every call-site.

create or replace view public.visible_flea_markets as
  select fm.*
  from public.flea_markets fm
  where public.is_market_visible(fm.id);

-- RLS on the underlying table already controls access; the view inherits it
-- (views are SECURITY INVOKER by default in Postgres 15+).
-- Grant select so anon and authenticated can query through PostgREST.
grant select on public.visible_flea_markets to anon, authenticated;

comment on view public.visible_flea_markets is
  'Publicly visible flea markets: published, not deleted, and — for temporary '
  'markets — having at least one future date rule. Excludes expired temporary '
  'markets. Do NOT use for organizer profile pages (they need listByOrganizer).';
