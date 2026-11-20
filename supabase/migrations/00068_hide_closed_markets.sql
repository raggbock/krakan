-- Hide closed markets from public listings.
--
-- flea_markets.status ('confirmed' | 'unverified' | 'closed') came in with the
-- business imports (00020), and /admin/markets has a "Stäng" action that sets
-- status = 'closed'. But is_market_visible() never looked at status, so a
-- market an admin had marked closed kept showing on the map, the city hubs
-- and in nearby search as if it were open. On 2026-11-20, 6 markets were
-- closed but still visible.
--
-- Closing is the admin's statement "this business no longer exists", so it
-- belongs in the visibility rule next to is_deleted. `is distinct from` keeps
-- NULL statuses (e.g. user-created markets) visible.
--
-- visible_flea_markets, nearby_flea_markets, nearby_cities_with_markets and
-- the notification triggers all call this function, so they pick up the
-- change without being redefined. No columns change, so no view refresh is
-- needed (see scripts/check-view-refreshes.mjs).

create or replace function public.is_market_visible(flea_market_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.flea_markets fm
    where fm.id = flea_market_id
      and fm.is_deleted = false
      and fm.published_at is not null
      and fm.status is distinct from 'closed'
      and (
        -- Permanent markets are always visible once published
        fm.is_permanent = true
        or
        -- Temporary markets are visible only if they have at least one future date rule
        exists (
          select 1
          from public.opening_hour_rules ohr
          where ohr.flea_market_id = fm.id
            and ohr.type = 'date'
            and ohr.anchor_date >= current_date
        )
      )
  )
$$;

comment on function public.is_market_visible(uuid) is
  'Returns true if the market should appear in public listings. '
  'Closed markets (status = ''closed'') are never visible. '
  'Permanent markets are visible when published; temporary markets require '
  'at least one future date rule (opening_hour_rules.type = ''date'').';
