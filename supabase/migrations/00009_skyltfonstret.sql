-- Add Stripe Customer ID for Skyltfönstret subscription billing
ALTER TABLE public.profiles ADD COLUMN stripe_customer_id text;

-- Unique index so we can look up profiles by Stripe Customer ID in webhooks
CREATE UNIQUE INDEX profiles_stripe_customer_idx
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
