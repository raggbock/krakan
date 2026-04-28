-- Visitor-initiated takeover requests from public market pages.
-- Stores each request so admin has a history + a count we can rate-limit
-- against. Service-role only — RLS denies all client access.
create table public.takeover_requests (
  id uuid primary key default gen_random_uuid(),
  flea_market_id uuid not null references public.flea_markets(id) on delete cascade,
  requester_email text not null,
  note text,
  created_at timestamptz not null default now(),
  -- For future admin workflow. Not enforced today; 'pending' for everything.
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined'))
);

create index takeover_requests_market_idx
  on public.takeover_requests (flea_market_id, created_at desc);
create index takeover_requests_email_idx
  on public.takeover_requests (lower(requester_email), created_at desc);

alter table public.takeover_requests enable row level security;

comment on table public.takeover_requests is
  'Visitor "I want to claim this market"-requests. Edge function inserts; '
  'admin reviews via dashboard and uses admin-takeover-send to actually '
  'issue the takeover token to the requester_email if approved.';
