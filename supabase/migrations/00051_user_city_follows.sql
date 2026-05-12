-- user_city_follows — stores follow relationships between users and cities.
-- This is issue #152 (city follows + follow button placement).
-- Notifications belong to issue #154.

create table public.user_city_follows (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  city_slug  text        not null,
  created_at timestamptz not null default now(),
  constraint user_city_follows_pkey primary key (user_id, city_slug)
);

-- Index for future fan-out queries (e.g. find all followers of a city).
create index user_city_follows_city_idx on public.user_city_follows (city_slug);

-- RLS: users can only see and modify their own follows.
alter table public.user_city_follows enable row level security;

create policy "users can select own city follows"
  on public.user_city_follows
  for select
  using (auth.uid() = user_id);

create policy "users can insert own city follows"
  on public.user_city_follows
  for insert
  with check (auth.uid() = user_id);

create policy "users can delete own city follows"
  on public.user_city_follows
  for delete
  using (auth.uid() = user_id);
