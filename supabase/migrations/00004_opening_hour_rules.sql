-- Create new tables
create table public.opening_hour_rules (
  id uuid primary key default gen_random_uuid(),
  flea_market_id uuid not null references public.flea_markets(id) on delete cascade,
  type text not null check (type in ('weekly', 'biweekly', 'date')),
  day_of_week smallint check (day_of_week between 0 and 6),
  anchor_date date,
  open_time time not null,
  close_time time not null,
  created_at timestamptz not null default now(),
  constraint opening_hour_rules_times_valid check (close_time > open_time),
  constraint opening_hour_rules_weekly_day check (
    type != 'weekly' or day_of_week is not null
  ),
  constraint opening_hour_rules_biweekly check (
    type != 'biweekly' or (day_of_week is not null and anchor_date is not null)
  ),
  constraint opening_hour_rules_date check (
    type != 'date' or anchor_date is not null
  )
);

create index opening_hour_rules_market_idx on public.opening_hour_rules (flea_market_id);

create table public.opening_hour_exceptions (
  id uuid primary key default gen_random_uuid(),
  flea_market_id uuid not null references public.flea_markets(id) on delete cascade,
  date date not null,
  reason text,
  created_at timestamptz not null default now()
);

create index opening_hour_exceptions_market_idx on public.opening_hour_exceptions (flea_market_id);

-- Migrate existing data
insert into public.opening_hour_rules (flea_market_id, type, day_of_week, anchor_date, open_time, close_time, created_at)
select
  flea_market_id,
  case when day_of_week is not null then 'weekly' else 'date' end,
  day_of_week,
  date,
  open_time,
  close_time,
  created_at
from public.opening_hours;

-- Drop old table
drop table public.opening_hours;

-- RLS for opening_hour_rules
alter table public.opening_hour_rules enable row level security;

create policy "Rules viewable with market"
  on public.opening_hour_rules for select
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id
        and (fm.published_at is not null or fm.organizer_id = auth.uid())
    )
  );

create policy "Organizer manages rules"
  on public.opening_hour_rules for all
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id
        and fm.organizer_id = auth.uid()
    )
  );

-- RLS for opening_hour_exceptions
alter table public.opening_hour_exceptions enable row level security;

create policy "Exceptions viewable with market"
  on public.opening_hour_exceptions for select
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id
        and (fm.published_at is not null or fm.organizer_id = auth.uid())
    )
  );

create policy "Organizer manages exceptions"
  on public.opening_hour_exceptions for all
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id
        and fm.organizer_id = auth.uid()
    )
  );
