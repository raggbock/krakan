-- notification_deliveries — per-user delivery state for notification_events.
-- One row per (user_id, event_id, channel) triple. The fan-out trigger
-- (00054/00055) inserts rows; users query their own via RLS; the email digest
-- edge function updates status via service_role.

create table public.notification_deliveries (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  event_id   uuid        not null references public.notification_events(id) on delete cascade,
  reason     text        not null check (reason in ('market', 'city')),
  channel    text        not null check (channel in ('inbox', 'email')),
  status     text        not null default 'pending'
                         check (status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  read_at    timestamptz,

  -- Dedup: one delivery per user per event per channel.
  constraint notification_deliveries_user_event_channel_key
    unique (user_id, event_id, channel)
);

-- For unread-count queries and inbox listing (filter by read_at IS NULL).
create index notification_deliveries_user_read_idx
  on public.notification_deliveries (user_id, read_at);

-- For the cron-driven digest: pull pending rows per channel.
create index notification_deliveries_status_channel_idx
  on public.notification_deliveries (status, channel);

-- RLS: users see only their own deliveries.
-- Insert/update is reserved for service_role (digest edge function, fan-out trigger).
alter table public.notification_deliveries enable row level security;

create policy "users can select own deliveries"
  on public.notification_deliveries
  for select
  using (auth.uid() = user_id);
