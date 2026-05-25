create or replace function public.nearby_cities_with_markets(
  target_city text,
  max_km double precision default 100,
  max_results int default 6
)
returns table (city text, market_count bigint, distance_km double precision)
language sql
stable
set search_path = public
as $$
  with centroids as (
    select
      fm.city,
      avg(fm.latitude) as lat,
      avg(fm.longitude) as lng,
      count(*) as market_count
    from public.flea_markets fm
    where fm.is_deleted = false
      and fm.published_at is not null
      and fm.latitude is not null
      and fm.longitude is not null
      and public.is_market_visible(fm.id)
    group by fm.city
  ),
  target as (
    select lat, lng from centroids where city = target_city
  ),
  distances as (
    select
      c.city,
      c.market_count,
      (2 * 6371 * asin(sqrt(
        power(sin(radians((c.lat - t.lat) / 2)), 2) +
        cos(radians(t.lat)) * cos(radians(c.lat)) *
        power(sin(radians((c.lng - t.lng) / 2)), 2)
      )))::double precision as distance_km
    from centroids c, target t
    where c.city <> target_city
  )
  select d.city, d.market_count, d.distance_km
  from distances d
  where d.distance_km <= max_km
  order by d.distance_km
  limit max_results;
$$;

grant execute on function public.nearby_cities_with_markets(text, double precision, int) to anon, authenticated;
