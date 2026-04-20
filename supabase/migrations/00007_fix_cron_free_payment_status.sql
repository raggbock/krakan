-- Fix cancel_expired_bookings() to preserve 'free' payment_status
-- for bookings that have no Stripe PaymentIntent.
create or replace function public.cancel_expired_bookings()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  cancelled_count integer;
begin
  update public.bookings
  set status = 'cancelled',
      payment_status = case
        when stripe_payment_intent_id is not null then 'cancelled'
        else 'free'
      end,
      updated_at = now()
  where status = 'pending'
    and expires_at is not null
    and expires_at < now();

  get diagnostics cancelled_count = row_count;
  return cancelled_count;
end;
$$;
