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

-- Fast replacement for the organizer_stats VIEW.
-- The view joins all profiles × markets × bookings with GROUP BY — full table scan.
-- This function takes a single organizer_id and only scans their data.
create or replace function public.organizer_stats_for(
  p_organizer_id uuid
)
returns table (
  organizer_id uuid,
  market_count bigint,
  total_bookings bigint,
  total_revenue_sek bigint,
  total_commission_sek bigint
)
language sql stable
as $$
  select
    p_organizer_id as organizer_id,
    (select count(*)::bigint from public.flea_markets where organizer_id = p_organizer_id and is_deleted = false) as market_count,
    count(b.id)::bigint filter (where b.status in ('pending', 'confirmed')) as total_bookings,
    coalesce(sum(b.price_sek) filter (where b.status = 'confirmed'), 0)::bigint as total_revenue_sek,
    coalesce(sum(b.commission_sek) filter (where b.status = 'confirmed'), 0)::bigint as total_commission_sek
  from public.flea_markets fm
  left join public.bookings b on b.flea_market_id = fm.id
  where fm.organizer_id = p_organizer_id
    and fm.is_deleted = false;
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
