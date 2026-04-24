-- 00019_admin_seed_bootstrap.sql
--
-- SEED THE FIRST ADMIN. This file ships with a placeholder UUID that will
-- intentionally fail to insert (foreign-key violation against auth.users).
-- Before running this migration against a real environment:
--
--   1. Ensure your auth user exists (sign up via /auth in the target env).
--   2. Replace the UUID below with your user_id (see SETUP-CHECKLIST).
--   3. Re-apply.
--
-- In CI/local dev where no auth.users row exists yet, this migration is a
-- no-op wrapped in a guard — it only runs when a matching auth.users row
-- exists for the configured UUID.

do $$
declare
  seed_uid uuid := '00000000-0000-0000-0000-000000000000'; -- REPLACE BEFORE PROD
begin
  if exists (select 1 from auth.users where id = seed_uid) then
    insert into public.admin_users (user_id, granted_by, notes)
    values (seed_uid, null, 'Initial seed')
    on conflict (user_id) do nothing;

    insert into public.admin_actions (admin_user_id, action, target_type, target_id, payload)
    values (seed_uid, 'admin.seed.bootstrap', 'admin_user', seed_uid::text, '{}'::jsonb);
  end if;
end $$;
