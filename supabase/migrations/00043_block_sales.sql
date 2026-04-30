-- Kvartersloppis: a single dated event where multiple households open
-- their home as a stand. Modeled separately from flea_markets because
-- stands have no tables/bookings and aren't individually indexed.

create table public.block_sales (
  id              uuid primary key default gen_random_uuid(),
  organizer_id    uuid not null references public.profiles(id) on delete cascade,
  name            text not null,
  slug            text not null unique,
  description     text,
  start_date      date not null,
  end_date        date not null,
  daily_open      time not null,
  daily_close     time not null,
  city            text not null,
  region          text,
  center_location geography(Point, 4326),
  published_at    timestamptz,
  is_deleted      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint block_sales_date_order check (end_date >= start_date),
  constraint block_sales_time_order check (daily_close > daily_open)
);

create index block_sales_organizer_idx on public.block_sales (organizer_id) where is_deleted = false;
create index block_sales_published_idx on public.block_sales (published_at, end_date) where is_deleted = false;
create index block_sales_city_idx on public.block_sales (lower(city)) where is_deleted = false and published_at is not null;

create table public.block_sale_stands (
  id                 uuid primary key default gen_random_uuid(),
  block_sale_id      uuid not null references public.block_sales(id) on delete cascade,
  user_id            uuid references auth.users(id) on delete set null,
  applicant_email    text not null,
  applicant_name     text not null,
  street             text not null,
  zip_code           text,
  city               text not null,
  location           geography(Point, 4326),
  description        text not null,
  status             text not null default 'pending'
    check (status in ('pending', 'confirmed', 'approved', 'rejected')),
  edit_token         text not null unique,
  email_confirmed_at timestamptz,
  decided_at         timestamptz,
  created_at         timestamptz not null default now(),
  constraint block_sale_stands_description_len check (char_length(description) <= 200)
);

create index block_sale_stands_event_idx on public.block_sale_stands (block_sale_id);
create index block_sale_stands_status_idx on public.block_sale_stands (block_sale_id, status);

-- Public read view: only approved stands on published events
create view public.visible_block_sale_stands with (security_invoker = true) as
  select s.*
  from public.block_sale_stands s
  join public.block_sales bs on bs.id = s.block_sale_id
  where s.status = 'approved'
    and bs.published_at is not null
    and bs.is_deleted = false;

-- RLS: block_sales
alter table public.block_sales enable row level security;

create policy block_sales_anon_read on public.block_sales
  for select to anon
  using (published_at is not null and is_deleted = false);

create policy block_sales_owner_all on public.block_sales
  for all to authenticated
  using (organizer_id = auth.uid())
  with check (organizer_id = auth.uid());

-- RLS: block_sale_stands
alter table public.block_sale_stands enable row level security;

create policy block_sale_stands_organizer_read on public.block_sale_stands
  for select to authenticated
  using (
    exists (
      select 1 from public.block_sales bs
      where bs.id = block_sale_id and bs.organizer_id = auth.uid()
    )
  );

create policy block_sale_stands_anon_read_approved on public.block_sale_stands
  for select to anon
  using (
    status = 'approved'
    and exists (
      select 1 from public.block_sales bs
      where bs.id = block_sale_id and bs.published_at is not null and bs.is_deleted = false
    )
  );

-- INSERT/UPDATE/DELETE blocked at table level — use edge functions only.
-- (No policies for these means no rows allowed.)

-- updated_at trigger
create trigger block_sales_updated_at
  before update on public.block_sales
  for each row execute function public.update_updated_at();
