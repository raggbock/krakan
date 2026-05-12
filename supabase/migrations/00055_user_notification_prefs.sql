-- user_notification_prefs — per-user email digest preferences.
-- Auto-created the first time a user follows a market or city.
-- The unsubscribe_token is a URL-safe random string used to identify
-- the user in the 1-click unsubscribe link without requiring login.

create table public.user_notification_prefs (
  user_id               uuid        primary key references auth.users(id) on delete cascade,
  email_digest_enabled  boolean     not null default true,
  -- ≥32 bytes of entropy: encode(gen_random_bytes(24), 'base64url') → 32-char URL-safe string
  unsubscribe_token     text        unique not null default encode(gen_random_bytes(24), 'base64url'),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Keep updated_at fresh on any change.
create or replace function public.set_notification_prefs_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

create trigger user_notification_prefs_updated_at
  before update on public.user_notification_prefs
  for each row
  execute function public.set_notification_prefs_updated_at();

-- RLS: users can only see and update their own prefs.
-- Insert is handled by the SECURITY DEFINER function below (auto-created on first follow).
alter table public.user_notification_prefs enable row level security;

create policy "users can select own notification prefs"
  on public.user_notification_prefs
  for select
  using (auth.uid() = user_id);

create policy "users can update own notification prefs"
  on public.user_notification_prefs
  for update
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Auto-create prefs row on first follow.
-- Triggered on INSERT to user_market_follows and user_city_follows.
-- Uses SECURITY DEFINER so it can bypass RLS on user_notification_prefs.
-- ---------------------------------------------------------------------------

create or replace function public.ensure_notification_prefs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_notification_prefs (user_id)
  values (NEW.user_id)
  on conflict (user_id) do nothing;
  return NEW;
end;
$$;

create trigger user_market_follows_ensure_prefs
  after insert on public.user_market_follows
  for each row
  execute function public.ensure_notification_prefs();

create trigger user_city_follows_ensure_prefs
  after insert on public.user_city_follows
  for each row
  execute function public.ensure_notification_prefs();
