-- Enable PostGIS for geo queries
create extension if not exists postgis with schema extensions;

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  first_name text,
  last_name text,
  phone_number text,
  user_type smallint not null default 0, -- 0 = visitor, 1 = organizer
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Flea markets
create table public.flea_markets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  street text,
  zip_code text,
  city text,
  country text default 'Sweden',
  location geography(point, 4326),
  is_permanent boolean not null default false,
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  published_at timestamptz,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Opening hours
create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  flea_market_id uuid not null references public.flea_markets(id) on delete cascade,
  day_of_week smallint, -- 0=Sunday..6=Saturday (for permanent markets)
  date date,            -- specific date (for temporary markets)
  open_time time not null,
  close_time time not null,
  created_at timestamptz not null default now()
);

-- Flea market images
create table public.flea_market_images (
  id uuid primary key default gen_random_uuid(),
  flea_market_id uuid not null references public.flea_markets(id) on delete cascade,
  storage_path text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

-- Indexes
create index flea_markets_location_idx on public.flea_markets using gist (location);
create index flea_markets_organizer_idx on public.flea_markets (organizer_id);
create index flea_markets_published_idx on public.flea_markets (published_at) where published_at is not null and is_deleted = false;
create index opening_hours_market_idx on public.opening_hours (flea_market_id);

-- Function: find nearby flea markets
create or replace function public.nearby_flea_markets(
  lat double precision,
  lng double precision,
  radius_km double precision default 30
)
returns table (
  id uuid,
  name text,
  description text,
  city text,
  is_permanent boolean,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  published_at timestamptz
)
language sql stable
as $$
  select
    fm.id,
    fm.name,
    fm.description,
    fm.city,
    fm.is_permanent,
    st_y(fm.location::geometry) as latitude,
    st_x(fm.location::geometry) as longitude,
    round((st_distance(fm.location, st_point(lng, lat)::geography) / 1000)::numeric, 1)::double precision as distance_km,
    fm.published_at
  from public.flea_markets fm
  where fm.is_deleted = false
    and fm.published_at is not null
    and st_dwithin(fm.location, st_point(lng, lat)::geography, radius_km * 1000)
  order by fm.location <-> st_point(lng, lat)::geography;
$$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated_at trigger
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger flea_markets_updated_at before update on public.flea_markets
  for each row execute function public.update_updated_at();

-- ============================================
-- Row Level Security
-- ============================================

alter table public.profiles enable row level security;
alter table public.flea_markets enable row level security;
alter table public.opening_hours enable row level security;
alter table public.flea_market_images enable row level security;

-- Profiles: users can read any profile, update own
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Flea markets: anyone can read published, organizers can CRUD own
create policy "Published flea markets are viewable by everyone"
  on public.flea_markets for select
  using (published_at is not null and is_deleted = false);

create policy "Organizers can view own unpublished"
  on public.flea_markets for select
  using (auth.uid() = organizer_id);

create policy "Organizers can create flea markets"
  on public.flea_markets for insert
  with check (auth.uid() = organizer_id);

create policy "Organizers can update own flea markets"
  on public.flea_markets for update
  using (auth.uid() = organizer_id);

create policy "Organizers can delete own flea markets"
  on public.flea_markets for delete
  using (auth.uid() = organizer_id);

-- Opening hours: readable with market, editable by organizer
create policy "Opening hours viewable with market"
  on public.opening_hours for select using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id
        and (fm.published_at is not null or fm.organizer_id = auth.uid())
    )
  );

create policy "Organizers can manage opening hours"
  on public.opening_hours for all using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id and fm.organizer_id = auth.uid()
    )
  );

-- Images: same pattern as opening hours
create policy "Images viewable with market"
  on public.flea_market_images for select using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id
        and (fm.published_at is not null or fm.organizer_id = auth.uid())
    )
  );

create policy "Organizers can manage images"
  on public.flea_market_images for all using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id and fm.organizer_id = auth.uid()
    )
  );

-- Storage bucket for flea market images
insert into storage.buckets (id, name, public)
values ('flea-market-images', 'flea-market-images', true)
on conflict do nothing;

create policy "Anyone can view flea market images"
  on storage.objects for select
  using (bucket_id = 'flea-market-images');

create policy "Authenticated users can upload images"
  on storage.objects for insert
  with check (bucket_id = 'flea-market-images' and auth.role() = 'authenticated');

create policy "Users can delete own images"
  on storage.objects for delete
  using (bucket_id = 'flea-market-images' and auth.uid()::text = (storage.foldername(name))[1]);
