-- Address Supabase database advisor findings:
--
--  ERROR  organizer_stats view is SECURITY DEFINER (replaced by organizer_stats_for fn)
--  WARN   function_search_path_mutable (4 functions)
--  WARN   auth_rls_initplan (23 policies call auth.uid() per row)
--  WARN   multiple_permissive_policies (partially — drop ad-hoc duplicate bookings policies)
--  WARN   duplicate_index (bookings + route_stops)
--  WARN   public_bucket_allows_listing (drop unused SELECT on storage.objects)
--
-- Remaining multiple_permissive_policies warnings on manage-vs-view pairs
-- require splitting ALL policies into INSERT/UPDATE/DELETE — deferred to a
-- follow-up since it changes no semantics and is pure perf polish.

-- ============================================
-- 1. Drop unused SECURITY DEFINER view
-- ============================================
-- Replaced by public.organizer_stats_for(p_organizer_id) in migration 00010.
-- No application code references the view anymore.

drop view if exists public.organizer_stats;


-- ============================================
-- 2. Pin search_path on utility/query functions
-- ============================================
-- Mutable search_path lets a role temporarily redefine builtins — harden by
-- locking the resolution path explicitly. PostGIS lives in `extensions`.

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.update_routes_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
set search_path = public, extensions
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
set search_path = public, extensions
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


-- ============================================
-- 3. Drop duplicate indexes
-- ============================================

drop index if exists public.idx_bookings_no_double_book;
-- kept: bookings_unique_table_date (same definition)

drop index if exists public.route_stops_flea_market_idx;
-- kept: route_stops_market_idx (same definition)


-- ============================================
-- 4. Drop ad-hoc duplicate bookings policies
-- ============================================
-- These were created directly against the DB (not via migration) and are
-- weaker versions of the hardened policies from 00008.

drop policy if exists "Users can cancel their own bookings" on public.bookings;
drop policy if exists "Organizers can manage booking status" on public.bookings;


-- ============================================
-- 5. Rewrite every RLS policy to use (select auth.uid())
-- ============================================
-- Wrapping auth.uid() in a subquery lets Postgres evaluate it once per
-- statement (initplan) instead of per row. Same access semantics.

-- --- profiles ---
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id);

-- --- flea_markets ---
drop policy if exists "Published flea markets are viewable by everyone" on public.flea_markets;
drop policy if exists "Organizers can view own unpublished" on public.flea_markets;
drop policy if exists "Organizers can create flea markets" on public.flea_markets;
drop policy if exists "Organizers can update own flea markets" on public.flea_markets;
drop policy if exists "Organizers can delete own flea markets" on public.flea_markets;

create policy "Published flea markets are viewable by everyone"
  on public.flea_markets for select
  using (published_at is not null and is_deleted = false);

create policy "Organizers can view own unpublished"
  on public.flea_markets for select
  using ((select auth.uid()) = organizer_id);

create policy "Organizers can create flea markets"
  on public.flea_markets for insert
  with check ((select auth.uid()) = organizer_id);

create policy "Organizers can update own flea markets"
  on public.flea_markets for update
  using ((select auth.uid()) = organizer_id);

create policy "Organizers can delete own flea markets"
  on public.flea_markets for delete
  using ((select auth.uid()) = organizer_id);

-- --- flea_market_images ---
drop policy if exists "Images viewable with market" on public.flea_market_images;
drop policy if exists "Organizers can manage images" on public.flea_market_images;

create policy "Images viewable with market"
  on public.flea_market_images for select
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_images.flea_market_id
        and (fm.published_at is not null or fm.organizer_id = (select auth.uid()))
    )
  );

create policy "Organizers can manage images"
  on public.flea_market_images for all
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_images.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );

-- --- market_tables ---
drop policy if exists "Market tables are viewable by everyone" on public.market_tables;
drop policy if exists "Market tables viewable on published markets" on public.market_tables;
drop policy if exists "Organizers can manage market tables" on public.market_tables;
drop policy if exists "Organizers can manage their market tables" on public.market_tables;

create policy "Market tables are viewable by everyone"
  on public.market_tables for select
  using (true);

create policy "Organizers can manage their market tables"
  on public.market_tables for all
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = market_tables.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );

-- --- bookings ---
drop policy if exists "Users can view own bookings" on public.bookings;
drop policy if exists "Users can view their own bookings" on public.bookings;
drop policy if exists "Organizers can view bookings for their markets" on public.bookings;
drop policy if exists "Authenticated users can create bookings" on public.bookings;
drop policy if exists "Users can create bookings" on public.bookings;
drop policy if exists "Users can cancel own bookings" on public.bookings;
drop policy if exists "Organizers can update booking status" on public.bookings;

create policy "Users can view their own bookings"
  on public.bookings for select
  using (booked_by = (select auth.uid()));

create policy "Organizers can view bookings for their markets"
  on public.bookings for select
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = bookings.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );

create policy "Users can create bookings"
  on public.bookings for insert
  with check (booked_by = (select auth.uid()));

create policy "Users can cancel own bookings"
  on public.bookings for update
  using ((select auth.uid()) = booked_by and status = 'pending')
  with check (status = 'cancelled');

create policy "Organizers can update booking status"
  on public.bookings for update
  using (
    status = 'pending'
    and exists (
      select 1 from public.flea_markets fm
      where fm.id = bookings.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  )
  with check (status in ('confirmed', 'denied'));

-- --- routes ---
drop policy if exists "Published routes are viewable by everyone" on public.routes;
drop policy if exists "Users can view own routes" on public.routes;
drop policy if exists "Users can create routes" on public.routes;
drop policy if exists "Users can update own routes" on public.routes;
drop policy if exists "Users can delete own routes" on public.routes;
drop policy if exists "Users can manage their own routes" on public.routes;

create policy "Published routes are viewable by everyone"
  on public.routes for select
  using (is_published = true and is_deleted = false);

create policy "Users can manage their own routes"
  on public.routes for all
  using ((select auth.uid()) = created_by);

-- --- route_stops ---
drop policy if exists "Route stops viewable with route" on public.route_stops;
drop policy if exists "Route stops viewable for published routes" on public.route_stops;
drop policy if exists "Users can manage own route stops" on public.route_stops;
drop policy if exists "Users can manage stops on their own routes" on public.route_stops;

create policy "Route stops viewable for published routes"
  on public.route_stops for select
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_stops.route_id
        and r.is_deleted = false
        and (r.is_published = true or r.created_by = (select auth.uid()))
    )
  );

create policy "Users can manage stops on their own routes"
  on public.route_stops for all
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_stops.route_id
        and r.created_by = (select auth.uid())
    )
  );

-- --- opening_hour_rules ---
drop policy if exists "Rules viewable with market" on public.opening_hour_rules;
drop policy if exists "Organizer manages rules" on public.opening_hour_rules;

create policy "Rules viewable with market"
  on public.opening_hour_rules for select
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = opening_hour_rules.flea_market_id
        and (fm.published_at is not null or fm.organizer_id = (select auth.uid()))
    )
  );

create policy "Organizer manages rules"
  on public.opening_hour_rules for all
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = opening_hour_rules.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );

-- --- opening_hour_exceptions ---
drop policy if exists "Exceptions viewable with market" on public.opening_hour_exceptions;
drop policy if exists "Organizer manages exceptions" on public.opening_hour_exceptions;

create policy "Exceptions viewable with market"
  on public.opening_hour_exceptions for select
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = opening_hour_exceptions.flea_market_id
        and (fm.published_at is not null or fm.organizer_id = (select auth.uid()))
    )
  );

create policy "Organizer manages exceptions"
  on public.opening_hour_exceptions for all
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = opening_hour_exceptions.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );

-- --- stripe_accounts ---
drop policy if exists "Organizers can view own stripe account" on public.stripe_accounts;

create policy "Organizers can view own stripe account"
  on public.stripe_accounts for select
  using ((select auth.uid()) = organizer_id);


-- ============================================
-- 6. Drop storage bucket SELECT policy (listing)
-- ============================================
-- Public buckets serve object URLs without needing SELECT on storage.objects.
-- Keeping the policy only enables anonymous listing of every image in the
-- bucket, which we never rely on.

drop policy if exists "Anyone can view flea market images" on storage.objects;
