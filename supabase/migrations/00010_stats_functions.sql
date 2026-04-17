-- Aggregated booking stats per market for an organizer.
-- Returns one row per (flea_market_id, status) with count and revenue.
-- Optionally filtered by a since-date.
create or replace function public.organizer_booking_stats(
  p_organizer_id uuid,
  p_since date default null
)
returns table (
  flea_market_id uuid,
  status text,
  booking_count bigint,
  revenue_sek bigint
)
language sql stable
as $$
  select
    b.flea_market_id,
    b.status,
    count(*)::bigint as booking_count,
    coalesce(sum(b.price_sek - b.commission_sek) filter (where b.status = 'confirmed'), 0)::bigint as revenue_sek
  from public.bookings b
  join public.flea_markets fm on fm.id = b.flea_market_id
  where fm.organizer_id = p_organizer_id
    and fm.is_deleted = false
    and (p_since is null or b.created_at >= p_since::timestamptz)
  group by b.flea_market_id, b.status;
$$;

-- Aggregated route inclusion counts per market for an organizer.
-- Returns one row per flea_market_id with count of route_stops.
create or replace function public.organizer_route_stats(
  p_organizer_id uuid,
  p_since date default null
)
returns table (
  flea_market_id uuid,
  route_count bigint
)
language sql stable
as $$
  select
    rs.flea_market_id,
    count(*)::bigint as route_count
  from public.route_stops rs
  join public.flea_markets fm on fm.id = rs.flea_market_id
  where fm.organizer_id = p_organizer_id
    and fm.is_deleted = false
    and (p_since is null or rs.created_at >= p_since::timestamptz)
  group by rs.flea_market_id;
$$;
