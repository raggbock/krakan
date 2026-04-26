-- Security review (2026-04-26): the 'Profiles are viewable by everyone'
-- policy uses `using (true)` which means anon visitors can SELECT every
-- column on profiles, including subscription_tier. Billing signal —
-- shouldn't be public. Lock it down to authenticated users (so the UI
-- can still show "you're a subscriber" badges for the signed-in user).

revoke select (subscription_tier) on public.profiles from anon, authenticated;
grant select (subscription_tier) on public.profiles to authenticated;
