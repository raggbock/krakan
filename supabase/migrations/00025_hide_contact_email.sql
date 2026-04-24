-- 00025_hide_contact_email.sql
-- contact_email on flea_markets is sourced from public records but
-- enabling harvesting via the RLS SELECT policy is a step worse than
-- the public sources themselves. Revoke column-level select so only
-- service-role (edge functions) can read the column.

revoke select (contact_email) on public.flea_markets from anon, authenticated;
