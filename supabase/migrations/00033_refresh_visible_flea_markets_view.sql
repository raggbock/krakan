-- Refresh visible_flea_markets so it picks up columns added after the view
-- was first created (slug from 00020, plus any later additions). Postgres
-- views freeze their column list at creation time when defined with `*`,
-- so new columns on the underlying table aren't auto-projected. CREATE OR
-- REPLACE re-expands `fm.*` against the current schema and appends missing
-- columns at the end — preserves the existing column order so dependent
-- queries don't break.

create or replace view public.visible_flea_markets as
  select fm.*
  from public.flea_markets fm
  where public.is_market_visible(fm.id);
