-- 00020_business_imports.sql
--
-- Adds proxy-import support for businesses (loppisar):
--   1. System-owned auth user + profile that owns proxy-imported markets
--      until the real owner takes over via takeover token.
--   2. New columns on flea_markets for slug, category, status, contact, etc.
--   3. business_owner_tokens table for the takeover flow.

-- 1. System owner ----------------------------------------------------------

-- Fixed UUID so app code can reference SYSTEM_OWNER_ID as a constant.
-- Login is impossible: encrypted_password is empty and email is .internal.
-- (UUID …001 was already taken by a legacy seed row, hence the f1d57 prefix.)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  'f1d57000-1000-4000-8000-000000000001'::uuid,
  'authenticated', 'authenticated',
  'system+import@fyndstigen.internal',
  '',
  now(), now(), now(),
  '{"provider":"system","providers":["system"]}'::jsonb,
  '{"system":true,"purpose":"proxy-imported businesses"}'::jsonb
)
on conflict (id) do nothing;

-- A profiles row may already exist if handle_new_user trigger fired.
-- Upsert so name/user_type are correct either way.
insert into public.profiles (id, first_name, last_name, user_type)
values (
  'f1d57000-1000-4000-8000-000000000001'::uuid,
  'Fyndstigen', 'Import', 1
)
on conflict (id) do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      user_type = excluded.user_type;

-- 2. flea_markets columns --------------------------------------------------

alter table public.flea_markets
  add column slug text,
  add column category text,
  add column status text not null default 'confirmed',
  add column municipality text,
  add column region text,
  add column contact_email text,
  add column contact_phone text,
  add column contact_website text,
  add column is_system_owned boolean not null default false;

create unique index flea_markets_slug_idx
  on public.flea_markets (slug)
  where slug is not null;

alter table public.flea_markets
  add constraint flea_markets_category_check
    check (category is null or category in (
      'Privat', 'Kyrklig-bistånd', 'Antik-retro',
      'Kommunal', 'Kedja', 'Evenemang'
    )),
  add constraint flea_markets_status_check
    check (status in ('confirmed', 'unverified', 'closed'));

-- 3. business_owner_tokens -------------------------------------------------

create table public.business_owner_tokens (
  id uuid primary key default gen_random_uuid(),
  flea_market_id uuid not null references public.flea_markets(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  used_at timestamptz,
  invalidated_at timestamptz,
  sent_to_email text,
  sent_at timestamptz,
  clicked_from_ip inet,
  priority smallint not null default 2 check (priority between 1 and 3),
  should_send_email boolean not null default true
);

create unique index business_owner_tokens_hash_idx
  on public.business_owner_tokens (token_hash);

create index business_owner_tokens_market_active_idx
  on public.business_owner_tokens (flea_market_id)
  where used_at is null and invalidated_at is null;

alter table public.business_owner_tokens enable row level security;
-- No policies: all access goes through edge functions with service-role.
