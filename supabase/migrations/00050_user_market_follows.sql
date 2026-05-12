-- user_market_follows — stores follow relationships between users and markets.
-- This is the tracer slice (issue #151) — notifications belong to issue #154.

create table public.user_market_follows (
  user_id       uuid        not null references auth.users(id) on delete cascade,
  flea_market_id uuid       not null references public.flea_markets(id) on delete cascade,
  created_at    timestamptz not null default now(),
  constraint user_market_follows_pkey primary key (user_id, flea_market_id)
);

-- Index for future fan-out queries (e.g. find all followers of a market).
create index user_market_follows_market_idx on public.user_market_follows (flea_market_id);

-- RLS: users can only see and modify their own follows.
alter table public.user_market_follows enable row level security;

create policy "users can select own follows"
  on public.user_market_follows
  for select
  using (auth.uid() = user_id);

create policy "users can insert own follows"
  on public.user_market_follows
  for insert
  with check (auth.uid() = user_id);

create policy "users can delete own follows"
  on public.user_market_follows
  for delete
  using (auth.uid() = user_id);
