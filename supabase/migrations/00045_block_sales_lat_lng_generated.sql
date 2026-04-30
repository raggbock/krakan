-- Add generated latitude/longitude columns to block_sales and block_sale_stands,
-- mirroring the pattern used on flea_markets (location::geometry ST_Y/ST_X).

alter table public.block_sales
  add column latitude double precision generated always as (st_y(center_location::geometry)) stored,
  add column longitude double precision generated always as (st_x(center_location::geometry)) stored;

alter table public.block_sale_stands
  add column latitude double precision generated always as (st_y(location::geometry)) stored,
  add column longitude double precision generated always as (st_x(location::geometry)) stored;

-- Rebuild the view so it exposes latitude/longitude for stands.
drop view if exists public.visible_block_sale_stands;

create view public.visible_block_sale_stands with (security_invoker = true) as
  select
    s.id,
    s.block_sale_id,
    s.street,
    s.zip_code,
    s.city,
    s.location,
    s.latitude,
    s.longitude,
    s.description,
    s.status,
    s.created_at
  from public.block_sale_stands s
  join public.block_sales bs on bs.id = s.block_sale_id
  where s.status = 'approved'
    and bs.published_at is not null
    and bs.is_deleted = false;

grant select on public.visible_block_sale_stands to anon, authenticated;
