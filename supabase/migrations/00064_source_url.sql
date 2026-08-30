-- Provenance for auto-imported rows: where we found the listing.
-- Distinct from contact_website, which is the business's own site.
-- Null for rows created by a human or by the manned FB round.
alter table public.flea_markets add column if not exists source_url text;
alter table public.block_sales  add column if not exists source_url text;

comment on column public.flea_markets.source_url is
  'Where this listing was found (kommun calendar, parish page, …). Required by the strict quality gate before an unattended import may publish. Not the business''s own website — that is contact_website.';
comment on column public.block_sales.source_url is
  'Where this listing was found. See flea_markets.source_url.';
