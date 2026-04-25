-- 00028_markets_open_now_rpc.sql
--
-- Returns the ids of currently-open visible markets based on opening_hour_rules
-- (weekly + biweekly) intersected with the present moment, minus markets with
-- a closing exception for today. Drives the "Öppet nu" filter on /utforska.
--
-- Stable + security invoker; relies on existing RLS which already exposes
-- visible_flea_markets and the rules/exceptions tables.

create or replace function public.markets_open_now()
returns table(id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  with now_utc as (select now() at time zone 'Europe/Stockholm' as ts),
  ctx as (
    select
      extract(dow from ts)::int as dow,    -- 0=Sun..6=Sat
      ts::time as t,
      ts::date as d
    from now_utc
  )
  select distinct fm.id
  from public.visible_flea_markets fm
  join public.opening_hour_rules ohr on ohr.flea_market_id = fm.id
  cross join ctx
  where ohr.type in ('weekly', 'biweekly')
    and ohr.day_of_week = ctx.dow
    and ohr.open_time <= ctx.t
    and ohr.close_time >= ctx.t
    and not exists (
      select 1 from public.opening_hour_exceptions e
      where e.flea_market_id = fm.id and e.date = ctx.d
    );
$$;

grant execute on function public.markets_open_now() to anon, authenticated;

comment on function public.markets_open_now() is
  'Visible markets currently open according to weekly/biweekly opening_hour_rules, minus those with a closing exception for today. Stockholm-local clock.';
