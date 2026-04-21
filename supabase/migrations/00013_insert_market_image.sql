-- Atomic INSERT for flea_market_images that computes sort_order in a single
-- statement. Eliminates the read-modify-write race in the previous
-- api.images.upload flow, where two concurrent uploads could collide on the
-- same sort_order (or leave gaps).
--
-- Called by the shared ImageService after a successful Storage upload; if this
-- function throws, the caller removes the orphan blob.

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
