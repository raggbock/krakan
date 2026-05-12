-- notification_events — append-only event log for market/city changes.
-- Each row records something that happened (market published, updated, etc.)
-- that the fan-out trigger (00054) will translate into per-user deliveries.
--
-- user_city_follows was created in 00051 (issue #152) and is already present.

-- notification_events — the core event log.
create table public.notification_events (
  id             uuid        primary key default gen_random_uuid(),
  type           text        not null,
  flea_market_id uuid        references public.flea_markets(id) on delete cascade,
  city_slug      text,
  payload        jsonb       not null default '{}',
  occurred_at    timestamptz not null default now()
);

-- Indexes for fan-out lookups and time-range queries.
create index notification_events_occurred_at_idx
  on public.notification_events (occurred_at);

create index notification_events_flea_market_id_idx
  on public.notification_events (flea_market_id)
  where flea_market_id is not null;

create index notification_events_city_slug_idx
  on public.notification_events (city_slug)
  where city_slug is not null;

-- RLS: service_role only — no direct user access.
alter table public.notification_events enable row level security;
-- No policies → only service_role / postgres superuser can read/write.
