-- 00022_business_imports_system_user.sql
-- Follow-up to 00020_business_imports. The original system-owner insert
-- in that migration used UUID …001 which turned out to already be taken
-- by a legacy seed row (seed@krakan.se). This migration inserts the real
-- system-owner under the f1d57000… UUID that the code references.
--
-- Idempotent: both inserts use ON CONFLICT DO NOTHING / DO UPDATE, so
-- running this against a freshly-bootstrapped 00020 is safe.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  'f1d57000-1000-4000-8000-000000000001'::uuid,
  'authenticated', 'authenticated',
  'system+import@fyndstigen.internal',
  '',
  now(), now(), now(),
  '{"provider":"system","providers":["system"]}'::jsonb,
  '{"system":true,"purpose":"proxy-imported businesses"}'::jsonb
)
on conflict (id) do nothing;

-- A profiles row may already exist if handle_new_user trigger fired on
-- the auth.users insert above. Upsert so name/user_type are correct.
insert into public.profiles (id, first_name, last_name, user_type)
values (
  'f1d57000-1000-4000-8000-000000000001'::uuid,
  'Fyndstigen', 'Import', 1
)
on conflict (id) do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      user_type = excluded.user_type;
