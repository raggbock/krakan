-- 00018_admin.sql
-- Admin-auth foundation: admins table, invite machinery, audit trail.

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  revoked_at timestamptz,
  notes text
);

create index admin_users_active_idx on public.admin_users (user_id)
  where revoked_at is null;

create table public.admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  accepted_from_ip text,
  revoked_at timestamptz
);

create index admin_invites_token_hash_idx on public.admin_invites (token_hash);
create index admin_invites_pending_idx on public.admin_invites (email)
  where accepted_at is null and revoked_at is null;

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  action text not null,
  target_type text,
  target_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_actions_created_at_idx on public.admin_actions (created_at desc);
create index admin_actions_admin_user_idx on public.admin_actions (admin_user_id, created_at desc);

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = uid and revoked_at is null
  );
$$;

alter table public.admin_users enable row level security;
alter table public.admin_invites enable row level security;
alter table public.admin_actions enable row level security;

create policy admin_users_select on public.admin_users for select using (public.is_admin());
create policy admin_invites_select on public.admin_invites for select using (public.is_admin());
create policy admin_actions_select on public.admin_actions for select using (public.is_admin());
-- No insert/update/delete policies — all writes go through edge functions with service-role.

-- Convenience view for the admin UI to show emails without granting direct
-- access to auth.users (which has RLS off by default).
create or replace view public.auth_user_email_view with (security_invoker = on) as
  select id, email from auth.users;

grant select on public.auth_user_email_view to authenticated;
