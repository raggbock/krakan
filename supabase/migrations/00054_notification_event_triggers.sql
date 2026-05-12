-- Notification event DB triggers (issue #154).
--
-- Three trigger sources:
--   1. flea_markets    AFTER UPDATE  → market.published / market.updated
--   2. opening_hour_rules AFTER INSERT → market.new_date
--   3. block_sales     AFTER UPDATE  → block_sale.published
--
-- All triggers write to notification_events; the fan-out trigger on that
-- table (below) then writes notification_deliveries rows.

-- ---------------------------------------------------------------------------
-- Helper: slugify_city — mirrors packages/shared/src/format.ts slugifyCity()
-- ---------------------------------------------------------------------------

create or replace function public.slugify_city(city text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select regexp_replace(
    regexp_replace(
      lower(
        translate(city,
          -- from chars       → to chars (same order)
          'åäöéèüÅÄÖÉÈÜ',
          'aaoeeuaaoeeu'
        )
      ),
      '[^a-z0-9]+', '-', 'g'
    ),
    '^-+|-+$', '', 'g'
  )
$$;

-- ---------------------------------------------------------------------------
-- Trigger function: emit_market_notification_event
-- Called AFTER UPDATE on flea_markets.
-- ---------------------------------------------------------------------------

create or replace function public.emit_market_notification_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_city_slug text;
begin
  -- 1. market.published — published_at newly set
  if OLD.published_at is null and NEW.published_at is not null then
    v_city_slug := case when NEW.city is not null then public.slugify_city(NEW.city) else null end;
    insert into public.notification_events (type, flea_market_id, city_slug, payload)
    values (
      'market.published',
      NEW.id,
      v_city_slug,
      jsonb_build_object('market_name', NEW.name, 'slug', NEW.slug)
    );
    -- Published event is emitted; don't also emit market.updated for same row.
    return NEW;
  end if;

  -- 2. market.updated — content changed on a visible market
  if public.is_market_visible(NEW.id) then
    if (OLD.description is distinct from NEW.description)
       or (OLD.name is distinct from NEW.name)
    then
      v_city_slug := case when NEW.city is not null then public.slugify_city(NEW.city) else null end;
      insert into public.notification_events (type, flea_market_id, city_slug, payload)
      values (
        'market.updated',
        NEW.id,
        v_city_slug,
        jsonb_build_object('market_name', NEW.name, 'slug', NEW.slug)
      );
    end if;
  end if;

  return NEW;
end;
$$;

create trigger flea_markets_notification_event
  after update on public.flea_markets
  for each row
  execute function public.emit_market_notification_event();

-- ---------------------------------------------------------------------------
-- Trigger function: emit_new_date_notification_event
-- Called AFTER INSERT on opening_hour_rules.
-- ---------------------------------------------------------------------------

create or replace function public.emit_new_date_notification_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market record;
  v_city_slug text;
begin
  -- Only emit for 'date'-type rules on visible markets.
  if NEW.type != 'date' then
    return NEW;
  end if;

  if not public.is_market_visible(NEW.flea_market_id) then
    return NEW;
  end if;

  select id, name, slug, city
    into v_market
    from public.flea_markets
   where id = NEW.flea_market_id;

  v_city_slug := case when v_market.city is not null then public.slugify_city(v_market.city) else null end;

  insert into public.notification_events (type, flea_market_id, city_slug, payload)
  values (
    'market.new_date',
    NEW.flea_market_id,
    v_city_slug,
    jsonb_build_object(
      'market_name',  v_market.name,
      'slug',         v_market.slug,
      'anchor_date',  NEW.anchor_date,
      'open_time',    NEW.open_time,
      'close_time',   NEW.close_time
    )
  );

  return NEW;
end;
$$;

create trigger opening_hour_rules_notification_event
  after insert on public.opening_hour_rules
  for each row
  execute function public.emit_new_date_notification_event();

-- ---------------------------------------------------------------------------
-- Trigger function: emit_block_sale_notification_event
-- Called AFTER UPDATE on block_sales.
-- ---------------------------------------------------------------------------

create or replace function public.emit_block_sale_notification_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_city_slug text;
begin
  -- Only emit when published_at transitions from NULL to non-NULL.
  if OLD.published_at is null and NEW.published_at is not null then
    v_city_slug := public.slugify_city(NEW.city);
    insert into public.notification_events (type, flea_market_id, city_slug, payload)
    values (
      'block_sale.published',
      null,  -- block_sales are not flea_markets
      v_city_slug,
      jsonb_build_object(
        'block_sale_id',  NEW.id,
        'block_sale_name', NEW.name,
        'slug',           NEW.slug,
        'city',           NEW.city,
        'start_date',     NEW.start_date,
        'end_date',       NEW.end_date
      )
    );
  end if;

  return NEW;
end;
$$;

create trigger block_sales_notification_event
  after update on public.block_sales
  for each row
  execute function public.emit_block_sale_notification_event();

-- ---------------------------------------------------------------------------
-- Fan-out trigger: notification_events AFTER INSERT
-- Inserts notification_deliveries rows for every follower.
-- Dedup rule: if user follows both the market AND the city for the same event,
-- emit reason='market'. Otherwise emit the matching reason.
-- Two rows per user: channel='inbox' + channel='email'.
-- ---------------------------------------------------------------------------

create or replace function public.fan_out_notification_deliveries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Insert one inbox + one email row per unique follower, respecting dedup:
  -- market-follow wins over city-follow.
  insert into public.notification_deliveries (user_id, event_id, reason, channel)
  select
    u.user_id,
    NEW.id,
    u.reason,
    c.channel
  from (
    -- Combine market followers and city followers, keeping highest-priority reason.
    select
      coalesce(mf.user_id, cf.user_id) as user_id,
      case when mf.user_id is not null then 'market' else 'city' end as reason
    from
      -- Market followers for this event's market (if any)
      (
        select user_id
        from public.user_market_follows
        where flea_market_id = NEW.flea_market_id
          and NEW.flea_market_id is not null
      ) mf
      full outer join
      -- City followers for this event's city (if any)
      (
        select user_id
        from public.user_city_follows
        where city_slug = NEW.city_slug
          and NEW.city_slug is not null
      ) cf
      on mf.user_id = cf.user_id
  ) u
  cross join (values ('inbox'), ('email')) as c(channel)
  on conflict (user_id, event_id, channel) do nothing;

  return NEW;
end;
$$;

create trigger notification_events_fan_out
  after insert on public.notification_events
  for each row
  execute function public.fan_out_notification_deliveries();
