-- Fix CHECK constraints to allow free bookings (price_sek = 0)
-- and new payment statuses ('free', 'requires_payment')

-- 1. Allow price_sek = 0 on market_tables and bookings
alter table public.market_tables
  drop constraint market_tables_price_positive;
alter table public.market_tables
  add constraint market_tables_price_non_negative
  check (price_sek >= 0);

alter table public.bookings
  drop constraint bookings_price_positive;
alter table public.bookings
  add constraint bookings_price_non_negative
  check (price_sek >= 0);

-- 2. Expand payment_status to include 'free' and 'requires_payment'
alter table public.bookings
  drop constraint bookings_payment_status_check;
alter table public.bookings
  add constraint bookings_payment_status_check
  check (payment_status in ('free', 'requires_payment', 'requires_capture', 'captured', 'cancelled', 'failed'));
