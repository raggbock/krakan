-- Add slug to nearby_flea_markets RPC so callers can build /loppis/[slug]
-- links directly without a second DB round-trip or a 308 redirect through
-- the legacy /fleamarkets/[id] path.
--
-- Keeps all existing columns in the same position; slug is appended at the
-- end so existing callsites that destructure by position are unaffected.

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
  published_at timestamptz,
  slug text
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
    fm.published_at,
    fm.slug
  from public.flea_markets fm
  where fm.is_deleted = false
    and fm.published_at is not null
    and st_dwithin(fm.location, st_point(lng, lat)::geography, radius_km * 1000)
    and is_market_visible(fm.id)
  order by fm.location <-> st_point(lng, lat)::geography;
$$;
