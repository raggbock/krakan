create table public.flea_market_slug_history (
  id uuid primary key default gen_random_uuid(),
  flea_market_id uuid not null references public.flea_markets(id) on delete cascade,
  old_slug text not null,
  replaced_at timestamptz not null default now(),
  unique (old_slug)
);

create index flea_market_slug_history_market_idx
  on public.flea_market_slug_history(flea_market_id, replaced_at desc);

comment on table public.flea_market_slug_history is
  'Old slugs preserved for 301 redirects when a market is renamed. '
  'unique(old_slug) prevents two markets from claiming the same historic '
  'slug — earliest claim wins. The /loppis/[slug] route falls back here '
  'when a slug doesn''t match a live market.';

-- RLS: public read (the 301 fallback is anonymous), service-role write only
alter table public.flea_market_slug_history enable row level security;

create policy "public read for redirect lookups"
  on public.flea_market_slug_history
  for select using (true);

-- No insert/update/delete policy → only service_role bypasses RLS.

grant select on public.flea_market_slug_history to anon, authenticated;
grant all on public.flea_market_slug_history to service_role;
