-- Soft-deleted rows shouldn't block uniqueness. Without this, merging two
-- markets that resolved to the same Google place_id failed because both
-- rows held the same value during the merge transaction.
drop index if exists public.flea_markets_google_place_id_idx;
create unique index flea_markets_google_place_id_idx
  on public.flea_markets (google_place_id)
  where google_place_id is not null and is_deleted = false;
