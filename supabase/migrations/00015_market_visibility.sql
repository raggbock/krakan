-- Migration: is_market_visible function
--
-- A market is publicly visible if:
--   1. It is permanent (is_permanent = true), published, and not deleted, OR
--   2. It is a non-permanent published non-deleted market that has at least one
--      opening_hour_rules row with type = 'date' and anchor_date >= current_date.
--
-- Exceptions (opening_hour_exceptions) only close markets — they cannot make
-- a temporary market visible.

create or replace function public.is_market_visible(flea_market_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.flea_markets fm
    where fm.id = flea_market_id
      and fm.is_deleted = false
      and fm.published_at is not null
      and (
        -- Permanent markets are always visible once published
        fm.is_permanent = true
        or
        -- Temporary markets are visible only if they have at least one future date rule
        exists (
          select 1
          from public.opening_hour_rules ohr
          where ohr.flea_market_id = fm.id
            and ohr.type = 'date'
            and ohr.anchor_date >= current_date
        )
      )
  )
$$;

-- Grant execute to authenticated and anon roles so PostgREST can call it
grant execute on function public.is_market_visible(uuid) to anon, authenticated;

-- Helpful comment
comment on function public.is_market_visible(uuid) is
  'Returns true if the market should appear in public listings. '
  'Permanent markets are visible when published; temporary markets require '
  'at least one future date rule (opening_hour_rules.type = ''date'').';
