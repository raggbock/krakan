-- ============================================
-- CRITICAL: Payment & webhook indexes
-- ============================================

-- Webhook handlers look up bookings by Stripe payment intent ID
create index bookings_stripe_payment_intent_idx
  on public.bookings (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- Webhook handler looks up stripe accounts by Stripe's account ID
create index stripe_accounts_stripe_account_id_idx
  on public.stripe_accounts (stripe_account_id);

-- Idempotency check: prevent duplicate pending bookings for same table+user+date
create index bookings_idempotency_idx
  on public.bookings (market_table_id, booked_by, booking_date)
  where status = 'pending';

-- ============================================
-- HIGH: Dashboard & availability indexes
-- ============================================

-- User's bookings list (sorted by date)
create index bookings_user_date_idx
  on public.bookings (booked_by, booking_date desc);

-- Organizer's bookings list (filtered by status, sorted by date)
create index bookings_market_status_date_idx
  on public.bookings (flea_market_id, status, booking_date)
  where status in ('pending', 'confirmed');

-- Available dates check (booking form)
create index bookings_table_status_idx
  on public.bookings (market_table_id, status)
  where status in ('pending', 'confirmed');

-- User's routes list
create index routes_user_active_idx
  on public.routes (created_by, created_at desc)
  where is_deleted = false;

-- Image upload: find max sort_order for a market
create index flea_market_images_market_sort_idx
  on public.flea_market_images (flea_market_id, sort_order desc);

-- ============================================
-- MEDIUM: FK indexes (not auto-created by PG)
-- ============================================

-- flea_market_images.flea_market_id (cascade deletes, queries)
create index flea_market_images_market_idx
  on public.flea_market_images (flea_market_id);

-- route_stops.flea_market_id (used in RPC joins)
create index route_stops_flea_market_idx
  on public.route_stops (flea_market_id);

-- routes.created_by (ownership checks)
create index routes_created_by_idx
  on public.routes (created_by);

-- ============================================
-- Search: text search on market names
-- ============================================

-- Enable trigram extension for fuzzy text search
create extension if not exists pg_trgm with schema extensions;

-- GIN trigram index for ILIKE search on market names
create index flea_markets_name_trgm_idx
  on public.flea_markets using gin (name extensions.gin_trgm_ops)
  where published_at is not null and is_deleted = false;

-- ============================================
-- CHECK constraints: data integrity
-- ============================================

alter table public.market_tables
  add constraint market_tables_price_positive
  check (price_sek > 0);

alter table public.bookings
  add constraint bookings_price_positive
  check (price_sek > 0);

alter table public.bookings
  add constraint bookings_commission_rate_valid
  check (commission_rate >= 0 and commission_rate <= 1);

alter table public.opening_hours
  add constraint opening_hours_times_valid
  check (close_time > open_time);
