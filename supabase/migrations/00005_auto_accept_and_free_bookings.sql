-- Add auto-accept toggle to flea markets
alter table public.flea_markets
  add column auto_accept_bookings boolean not null default false;

-- Allow price 0 as default for market tables
alter table public.market_tables
  alter column price_sek set default 0;
