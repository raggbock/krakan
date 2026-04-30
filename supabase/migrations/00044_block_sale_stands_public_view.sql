-- Tighten public read surface for block_sale_stands.
--
-- Original 00043 had two problems:
--   1. block_sale_stands_anon_read_approved RLS policy let anon SELECT *
--      directly from the table, exposing edit_token (the auth credential
--      for /block-sale-stand-edit) and applicant_email (personuppgift).
--   2. visible_block_sale_stands view used SELECT s.* which propagated
--      every column even after we'd intend it as the safe surface.
--
-- This migration removes anon table access and rewrites the view to
-- expose only public columns. Edge functions still write via service
-- role (no policy needed for that).

drop policy if exists block_sale_stands_anon_read_approved on public.block_sale_stands;

drop view if exists public.visible_block_sale_stands;

create view public.visible_block_sale_stands with (security_invoker = true) as
  select
    s.id,
    s.block_sale_id,
    s.street,
    s.zip_code,
    s.city,
    s.location,
    s.description,
    s.status,
    s.created_at
  from public.block_sale_stands s
  join public.block_sales bs on bs.id = s.block_sale_id
  where s.status = 'approved'
    and bs.published_at is not null
    and bs.is_deleted = false;

-- Allow anon SELECT on the view itself. With security_invoker=true the
-- view enforces RLS as the caller, but the underlying table now has no
-- anon SELECT policy → the view's SELECT is what grants public access.
grant select on public.visible_block_sale_stands to anon, authenticated;
