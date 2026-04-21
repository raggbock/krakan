-- Eliminate remaining multiple_permissive_policies warnings by:
--   (a) splitting FOR ALL "manage" policies into FOR INSERT/UPDATE/DELETE so
--       they don't stack with a specific SELECT policy,
--   (b) merging pairs of SELECT policies into one OR'd policy,
--   (c) merging the bookings UPDATE policy pair into one.
--
-- All access semantics are preserved — Postgres evaluates the OR union
-- instead of running two policies against each row.


-- ============================================
-- flea_market_images
-- ============================================
-- Before: ALL (manage) + SELECT (public view). After: 1 SELECT + INSERT/UPDATE/DELETE.

drop policy if exists "Organizers can manage images" on public.flea_market_images;
drop policy if exists "Images viewable with market" on public.flea_market_images;

create policy "Images viewable with market"
  on public.flea_market_images for select
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_images.flea_market_id
        and (fm.published_at is not null or fm.organizer_id = (select auth.uid()))
    )
  );

create policy "Organizers can insert images"
  on public.flea_market_images for insert
  with check (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_images.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );

create policy "Organizers can update images"
  on public.flea_market_images for update
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_images.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );

create policy "Organizers can delete images"
  on public.flea_market_images for delete
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_images.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );


-- ============================================
-- market_tables
-- ============================================

drop policy if exists "Organizers can manage their market tables" on public.market_tables;

create policy "Organizers can insert market tables"
  on public.market_tables for insert
  with check (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = market_tables.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );

create policy "Organizers can update market tables"
  on public.market_tables for update
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = market_tables.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );

create policy "Organizers can delete market tables"
  on public.market_tables for delete
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = market_tables.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );


-- ============================================
-- opening_hour_rules
-- ============================================

drop policy if exists "Organizer manages rules" on public.opening_hour_rules;

create policy "Organizer can insert rules"
  on public.opening_hour_rules for insert
  with check (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = opening_hour_rules.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );

create policy "Organizer can update rules"
  on public.opening_hour_rules for update
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = opening_hour_rules.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );

create policy "Organizer can delete rules"
  on public.opening_hour_rules for delete
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = opening_hour_rules.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );


-- ============================================
-- opening_hour_exceptions
-- ============================================

drop policy if exists "Organizer manages exceptions" on public.opening_hour_exceptions;

create policy "Organizer can insert exceptions"
  on public.opening_hour_exceptions for insert
  with check (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = opening_hour_exceptions.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );

create policy "Organizer can update exceptions"
  on public.opening_hour_exceptions for update
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = opening_hour_exceptions.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );

create policy "Organizer can delete exceptions"
  on public.opening_hour_exceptions for delete
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = opening_hour_exceptions.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );


-- ============================================
-- routes
-- ============================================
-- Before: ALL (own) + SELECT (published). After: 1 merged SELECT + INSERT/UPDATE/DELETE.

drop policy if exists "Users can manage their own routes" on public.routes;
drop policy if exists "Published routes are viewable by everyone" on public.routes;

create policy "Routes visible to owner or public when published"
  on public.routes for select
  using (
    (is_published = true and is_deleted = false)
    or created_by = (select auth.uid())
  );

create policy "Users can create own routes"
  on public.routes for insert
  with check (created_by = (select auth.uid()));

create policy "Users can update own routes"
  on public.routes for update
  using (created_by = (select auth.uid()));

create policy "Users can delete own routes"
  on public.routes for delete
  using (created_by = (select auth.uid()));


-- ============================================
-- route_stops
-- ============================================
-- Before: ALL (own route) + SELECT (published route). After: merged SELECT covers both.

drop policy if exists "Users can manage stops on their own routes" on public.route_stops;
drop policy if exists "Route stops viewable for published routes" on public.route_stops;

create policy "Route stops viewable with route"
  on public.route_stops for select
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_stops.route_id
        and r.is_deleted = false
        and (r.is_published = true or r.created_by = (select auth.uid()))
    )
  );

create policy "Users can insert own route stops"
  on public.route_stops for insert
  with check (
    exists (
      select 1 from public.routes r
      where r.id = route_stops.route_id
        and r.created_by = (select auth.uid())
    )
  );

create policy "Users can update own route stops"
  on public.route_stops for update
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_stops.route_id
        and r.created_by = (select auth.uid())
    )
  );

create policy "Users can delete own route stops"
  on public.route_stops for delete
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_stops.route_id
        and r.created_by = (select auth.uid())
    )
  );


-- ============================================
-- flea_markets (merge two SELECT policies)
-- ============================================

drop policy if exists "Published flea markets are viewable by everyone" on public.flea_markets;
drop policy if exists "Organizers can view own unpublished" on public.flea_markets;

create policy "Flea markets visible to organizer or publicly when published"
  on public.flea_markets for select
  using (
    (published_at is not null and is_deleted = false)
    or organizer_id = (select auth.uid())
  );


-- ============================================
-- bookings (merge SELECT pair + UPDATE pair)
-- ============================================

drop policy if exists "Users can view their own bookings" on public.bookings;
drop policy if exists "Organizers can view bookings for their markets" on public.bookings;

create policy "Bookings visible to booker or market organizer"
  on public.bookings for select
  using (
    booked_by = (select auth.uid())
    or exists (
      select 1 from public.flea_markets fm
      where fm.id = bookings.flea_market_id
        and fm.organizer_id = (select auth.uid())
    )
  );

drop policy if exists "Users can cancel own bookings" on public.bookings;
drop policy if exists "Organizers can update booking status" on public.bookings;

-- One UPDATE policy covering both flows:
--   booker → pending to cancelled
--   organizer → pending to confirmed/denied
create policy "Booking status transitions"
  on public.bookings for update
  using (
    status = 'pending'
    and (
      booked_by = (select auth.uid())
      or exists (
        select 1 from public.flea_markets fm
        where fm.id = bookings.flea_market_id
          and fm.organizer_id = (select auth.uid())
      )
    )
  )
  with check (
    (booked_by = (select auth.uid()) and status = 'cancelled')
    or (
      status in ('confirmed', 'denied')
      and exists (
        select 1 from public.flea_markets fm
        where fm.id = bookings.flea_market_id
          and fm.organizer_id = (select auth.uid())
      )
    )
  );
