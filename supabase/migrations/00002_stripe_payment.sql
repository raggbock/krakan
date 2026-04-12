-- Stripe Connect accounts for organizers
create table public.stripe_accounts (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade unique,
  stripe_account_id text not null,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stripe_accounts_organizer_idx on public.stripe_accounts (organizer_id);

-- Updated_at trigger
create trigger stripe_accounts_updated_at before update on public.stripe_accounts
  for each row execute function public.update_updated_at();

-- RLS: organizers can read their own row
alter table public.stripe_accounts enable row level security;

create policy "Organizers can view own stripe account"
  on public.stripe_accounts for select
  using (auth.uid() = organizer_id);

-- Edge functions use service_role to insert/update, so no insert/update policies needed for users

-- Extend bookings table with payment columns
alter table public.bookings
  add column stripe_payment_intent_id text,
  add column payment_status text check (payment_status in ('requires_capture', 'captured', 'cancelled', 'failed')),
  add column expires_at timestamptz;

create index bookings_expires_idx on public.bookings (expires_at) where status = 'pending' and expires_at is not null;

-- Function to auto-cancel expired bookings (called by pg_cron)
create or replace function public.cancel_expired_bookings()
returns integer
language plpgsql security definer
as $$
declare
  cancelled_count integer;
begin
  update public.bookings
  set status = 'cancelled',
      payment_status = 'cancelled',
      updated_at = now()
  where status = 'pending'
    and expires_at is not null
    and expires_at < now();

  get diagnostics cancelled_count = row_count;
  return cancelled_count;
end;
$$;

-- Schedule auto-cancel (requires pg_cron extension enabled via Supabase dashboard)
-- Runs daily at 03:00 UTC
select cron.schedule(
  'cancel-expired-bookings',
  '0 3 * * *',
  $$select public.cancel_expired_bookings()$$
);
