-- Add audit timestamps stamped by the BookingLifecycle reducer
-- (packages/shared/src/booking-lifecycle.ts). Previously Supabase silently
-- dropped these fields from the update patch because the columns didn't
-- exist; now they persist the transition moment.

alter table public.bookings
  add column if not exists captured_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists denied_at timestamptz;
