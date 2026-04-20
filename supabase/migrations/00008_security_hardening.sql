-- Security hardening: restrict RLS update policies, scope storage uploads, fail-closed CORS

-- ============================================
-- 1. Restrict booking update policies
-- ============================================

-- Drop the overly permissive policies
drop policy if exists "Users can cancel own bookings" on public.bookings;
drop policy if exists "Organizers can update booking status" on public.bookings;

-- Users can only cancel their own pending bookings (status → cancelled only)
create policy "Users can cancel own bookings"
  on public.bookings for update
  using (auth.uid() = booked_by and status = 'pending')
  with check (status = 'cancelled');

-- Organizers can only confirm or deny pending bookings for their markets
create policy "Organizers can update booking status"
  on public.bookings for update
  using (
    status = 'pending'
    and exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id and fm.organizer_id = auth.uid()
    )
  )
  with check (status in ('confirmed', 'denied'));

-- ============================================
-- 2. Scope storage uploads to organizer's own markets
-- ============================================
-- Upload path is: {flea_market_id}/{uuid}.{ext}
-- Verify the user is the organizer of that market.

drop policy if exists "Authenticated users can upload images" on storage.objects;

create policy "Organizers can upload images for own markets"
  on storage.objects for insert
  with check (
    bucket_id = 'flea-market-images'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.flea_markets fm
      where fm.id::text = (storage.foldername(name))[1]
        and fm.organizer_id = auth.uid()
    )
  );
