-- Migration: fix globally-broken flea-market image upload.
--
-- Two independent bugs prevented ANY organizer from uploading images
-- (flea_market_images had 0 rows in production):
--
-- Bug 1 — RLS column shadowing (live since 00008_security_hardening.sql).
--   The storage-upload policy intended `(storage.foldername(name))[1]` to read
--   the uploaded OBJECT's path. But the EXISTS subquery selects `from
--   flea_markets fm`, and flea_markets also has a `name` column — so unqualified
--   `name` bound to flea_markets.name (the market's display name) instead of
--   storage.objects.name. A display name has no '/', so foldername() returned
--   empty, the EXISTS never matched, and every upload was denied. Fix: qualify
--   the reference as storage.objects.name so it can no longer be shadowed.
--
-- Bug 2 — orphaned migration. 00013_insert_market_image.sql (the
--   insert_flea_market_image RPC the image adapter calls after a successful
--   upload) was never applied to the remote database. Recreate it here so the
--   fix is self-contained regardless of 00013's history.

-- ---------- Bug 1: re-scope the storage upload policy ----------
drop policy if exists "Organizers can upload images for own markets" on storage.objects;

create policy "Organizers can upload images for own markets"
  on storage.objects for insert
  with check (
    bucket_id = 'flea-market-images'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.flea_markets fm
      -- storage.objects.name fully qualified — must NOT bind to flea_markets.name
      where fm.id::text = (storage.foldername(storage.objects.name))[1]
        and fm.organizer_id = auth.uid()
    )
  );

-- ---------- Bug 2: (re)create the image-insert RPC ----------
-- Atomic INSERT that computes sort_order in a single statement, avoiding the
-- read-modify-write race two concurrent uploads could hit. Mirror of
-- 00013_insert_market_image.sql.
create or replace function public.insert_flea_market_image(
  p_flea_market_id uuid,
  p_storage_path text
)
returns public.flea_market_images
language sql
security invoker
set search_path = public
as $$
  insert into public.flea_market_images (flea_market_id, storage_path, sort_order)
  select
    p_flea_market_id,
    p_storage_path,
    coalesce(max(sort_order), -1) + 1
  from public.flea_market_images
  where flea_market_id = p_flea_market_id
  returning *;
$$;

grant execute on function public.insert_flea_market_image(uuid, text) to authenticated;
