-- Migration: nearby_flea_markets now filters by is_market_visible()
--
-- Recreates the function adding `and is_market_visible(fm.id)` to the WHERE
-- clause so expired temporary markets are excluded from proximity queries.

create or replace function public.nearby_flea_markets(
  lat double precision,
  lng double precision,
  radius_km double precision default 30
)
returns table (
  id uuid,
  name text,
  description text,
  city text,
  is_permanent boolean,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  published_at timestamptz
)
language sql stable
set search_path = public, extensions
as $$
  select
    fm.id,
    fm.name,
    fm.description,
    fm.city,
    fm.is_permanent,
    st_y(fm.location::geometry) as latitude,
    st_x(fm.location::geometry) as longitude,
    round((st_distance(fm.location, st_point(lng, lat)::geography) / 1000)::numeric, 1)::double precision as distance_km,
    fm.published_at
  from public.flea_markets fm
  where fm.is_deleted = false
    and fm.published_at is not null
    and st_dwithin(fm.location, st_point(lng, lat)::geography, radius_km * 1000)
    and is_market_visible(fm.id)
  order by fm.location <-> st_point(lng, lat)::geography;
$$;
