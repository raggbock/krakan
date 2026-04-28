-- Track first time the takeover-info endpoint is hit for a given token
-- so we can build a funnel: sent → clicked → email → code → claimed.
-- Stamp once on first call, then leave alone — second visits aren't
-- meaningful for engagement metrics.
alter table public.business_owner_tokens
  add column clicked_at timestamptz;

create index business_owner_tokens_funnel_idx
  on public.business_owner_tokens (sent_at desc)
  where used_at is null and invalidated_at is null;
