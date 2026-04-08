-- Enable PostGIS for geo queries
create extension if not exists postgis with schema extensions;

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  first_name text,
  last_name text,
  phone_number text,
  user_type smallint not null default 0, -- 0 = visitor, 1 = organizer
  bio text,
  website text,
  logo_path text,
  subscription_tier smallint not null default 0, -- 0 = free, 1 = premium
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
  latitude double precision generated always as (st_y(location::geometry)) stored,
  longitude double precision generated always as (st_x(location::geometry)) stored,
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

-- Market tables (bookable table types at a flea market)
create table public.market_tables (
  id uuid primary key default gen_random_uuid(),
  flea_market_id uuid not null references public.flea_markets(id) on delete cascade,
  label text not null,
  description text,
  price_sek integer not null,
  size_description text,
  is_available boolean not null default true,
  max_per_day integer not null default 1,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  market_table_id uuid not null references public.market_tables(id),
  flea_market_id uuid not null references public.flea_markets(id),
  booked_by uuid not null references public.profiles(id),
  booking_date date not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'denied', 'cancelled')),
  price_sek integer not null,
  commission_sek integer not null default 0,
  commission_rate numeric not null default 0.12,
  message text,
  organizer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Routes (loppisrundor)
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.profiles(id),
  start_latitude double precision,
  start_longitude double precision,
  planned_date date,
  is_published boolean not null default false,
  published_at timestamptz,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Route stops
create table public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  flea_market_id uuid not null references public.flea_markets(id),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================
-- Indexes
-- ============================================

create index flea_markets_location_idx on public.flea_markets using gist (location);
create index flea_markets_organizer_idx on public.flea_markets (organizer_id);
create index flea_markets_published_idx on public.flea_markets (published_at) where published_at is not null and is_deleted = false;
create index opening_hours_market_idx on public.opening_hours (flea_market_id);
create index market_tables_market_idx on public.market_tables (flea_market_id);
create index bookings_market_idx on public.bookings (flea_market_id);
create index bookings_user_idx on public.bookings (booked_by);
create index bookings_table_date_idx on public.bookings (market_table_id, booking_date);
create index route_stops_route_idx on public.route_stops (route_id);

-- ============================================
-- Views
-- ============================================

-- Organizer stats (auto-calculated from bookings + markets)
create or replace view public.organizer_stats as
select
  p.id as organizer_id,
  count(distinct fm.id) filter (where fm.is_deleted = false) as market_count,
  count(b.id) filter (where b.status in ('pending', 'confirmed')) as total_bookings,
  coalesce(sum(b.price_sek) filter (where b.status = 'confirmed'), 0) as total_revenue_sek,
  coalesce(sum(b.commission_sek) filter (where b.status = 'confirmed'), 0) as total_commission_sek
from public.profiles p
left join public.flea_markets fm on fm.organizer_id = p.id
left join public.bookings b on b.flea_market_id = fm.id
group by p.id;

-- ============================================
-- Functions
-- ============================================

-- Find nearby flea markets
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

-- Find popular published routes near a location
create or replace function public.popular_routes_nearby(
  lat double precision,
  lng double precision,
  radius_km double precision default 30
)
returns table (
  id uuid,
  name text,
  description text,
  created_by uuid,
  planned_date date,
  published_at timestamptz,
  stop_count bigint,
  creator_first_name text,
  creator_last_name text
)
language sql stable
as $$
  select
    r.id,
    r.name,
    r.description,
    r.created_by,
    r.planned_date,
    r.published_at,
    count(rs.id) as stop_count,
    p.first_name as creator_first_name,
    p.last_name as creator_last_name
  from public.routes r
  join public.route_stops rs on rs.route_id = r.id
  join public.flea_markets fm on fm.id = rs.flea_market_id
  join public.profiles p on p.id = r.created_by
  where r.is_published = true
    and r.is_deleted = false
    and fm.is_deleted = false
    and st_dwithin(fm.location, st_point(lng, lat)::geography, radius_km * 1000)
  group by r.id, r.name, r.description, r.created_by, r.planned_date, r.published_at, p.first_name, p.last_name
  order by count(rs.id) desc, r.published_at desc;
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

create trigger market_tables_updated_at before update on public.market_tables
  for each row execute function public.update_updated_at();

create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.update_updated_at();

create trigger routes_updated_at before update on public.routes
  for each row execute function public.update_updated_at();

-- ============================================
-- Row Level Security
-- ============================================

alter table public.profiles enable row level security;
alter table public.flea_markets enable row level security;
alter table public.opening_hours enable row level security;
alter table public.flea_market_images enable row level security;
alter table public.market_tables enable row level security;
alter table public.bookings enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;

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

-- Market tables: viewable on published markets, manageable by organizer
create policy "Market tables viewable on published markets"
  on public.market_tables for select using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id
        and (fm.published_at is not null or fm.organizer_id = auth.uid())
    )
  );

create policy "Organizers can manage market tables"
  on public.market_tables for all using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id and fm.organizer_id = auth.uid()
    )
  );

-- Bookings: users see own, organizers see for their markets
create policy "Users can view own bookings"
  on public.bookings for select
  using (auth.uid() = booked_by);

create policy "Organizers can view bookings for their markets"
  on public.bookings for select using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id and fm.organizer_id = auth.uid()
    )
  );

create policy "Authenticated users can create bookings"
  on public.bookings for insert
  with check (auth.uid() = booked_by);

create policy "Organizers can update booking status"
  on public.bookings for update using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id and fm.organizer_id = auth.uid()
    )
  );

create policy "Users can cancel own bookings"
  on public.bookings for update
  using (auth.uid() = booked_by);

-- Routes: published readable by all, own routes manageable
create policy "Published routes are viewable by everyone"
  on public.routes for select
  using (is_published = true and is_deleted = false);

create policy "Users can view own routes"
  on public.routes for select
  using (auth.uid() = created_by);

create policy "Users can create routes"
  on public.routes for insert
  with check (auth.uid() = created_by);

create policy "Users can update own routes"
  on public.routes for update
  using (auth.uid() = created_by);

create policy "Users can delete own routes"
  on public.routes for delete
  using (auth.uid() = created_by);

-- Route stops: viewable with route, manageable by route creator
create policy "Route stops viewable with route"
  on public.route_stops for select using (
    exists (
      select 1 from public.routes r
      where r.id = route_id
        and (r.is_published = true or r.created_by = auth.uid())
    )
  );

create policy "Users can manage own route stops"
  on public.route_stops for all using (
    exists (
      select 1 from public.routes r
      where r.id = route_id and r.created_by = auth.uid()
    )
  );

-- ============================================
-- Storage
-- ============================================

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
