-- 00027_market_social_links.sql
--
-- Adds Facebook + Instagram URL columns to flea_markets so admins can record
-- a market's social presence alongside the website. Both nullable; loose text
-- (URL validation happens in the edit form, not at the DB layer).

alter table public.flea_markets
  add column contact_facebook text,
  add column contact_instagram text;

comment on column public.flea_markets.contact_facebook is
  'Public Facebook URL (e.g. https://facebook.com/...). Editable by organizer or admin.';

comment on column public.flea_markets.contact_instagram is
  'Public Instagram URL (e.g. https://instagram.com/...). Editable by organizer or admin.';
