-- Migration: auto-generate flea_markets.slug on insert.
--
-- Bug: the logged-in organizer create flow (web/src/app/profile/create-market →
-- runMarketMutation → createSupabaseFleaMarkets.create) inserts a market WITHOUT
-- a slug. Only the anonymous /skapa flow (public-market-create edge function)
-- called pickUniqueSlug. So organizer-created markets got slug=NULL, and the
-- post-create redirect to /fleamarkets/[id] 404'd (getMarketSlugById → null →
-- notFound), leaving the market unreachable by its canonical /loppis/[slug] URL.
--
-- Fix: enforce the invariant in the schema instead of in one code path. A
-- BEFORE INSERT trigger fills slug when null, synchronously, so the row already
-- has its slug by the time the client redirects. Mirrors the edge function's
-- pickUniqueSlug: unique against live slugs AND flea_market_slug_history claims.
-- Rows that already provide a slug (edge function, bulk imports) are untouched.

-- Reusable unique-slug picker (also used by the backfill below). SECURITY
-- DEFINER so the uniqueness checks see ALL markets, not just RLS-visible ones.
create or replace function public.pick_flea_market_slug(
  p_name text,
  p_city text,
  p_exclude_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base      text;
  v_candidate text;
  i           int := 1;
begin
  if p_name is null or btrim(p_name) = '' then
    return null;
  end if;

  -- slugify_city lowercases, transliterates åäö…, collapses non-alnum to '-',
  -- and trims leading/trailing '-'. "name-city" matches the edge function's base.
  v_base := slugify_city(p_name || '-' || coalesce(p_city, ''));
  if v_base is null or v_base = '' then
    return null;
  end if;

  -- base, base-2, base-3, … skipping live slugs and historic redirect claims.
  loop
    v_candidate := case when i = 1 then v_base else v_base || '-' || i end;
    if not exists (
          select 1 from public.flea_markets
          where slug = v_candidate
            and (p_exclude_id is null or id <> p_exclude_id))
       and not exists (
          select 1 from public.flea_market_slug_history
          where old_slug = v_candidate
            and (p_exclude_id is null or flea_market_id <> p_exclude_id))
    then
      return v_candidate;
    end if;
    i := i + 1;
    exit when i > 50;
  end loop;

  -- Pathological fallback (50 collisions). The unique partial index on slug
  -- still guarantees correctness even if this somehow collides.
  return v_base || '-' || floor(extract(epoch from clock_timestamp()))::bigint;
end;
$$;

create or replace function public.set_flea_market_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slug is null then
    new.slug := public.pick_flea_market_slug(new.name, new.city);
  end if;
  return new;
end;
$$;

drop trigger if exists flea_markets_set_slug on public.flea_markets;
create trigger flea_markets_set_slug
before insert on public.flea_markets
for each row
execute function public.set_flea_market_slug();

-- Backfill active markets that already slipped through with a null slug.
-- Updates only `slug`, so emit_market_notification_event (which fires on
-- published_at / name / description changes) emits nothing.
do $$
declare r record;
begin
  for r in
    select id, name, city
    from public.flea_markets
    where slug is null and is_deleted = false
    order by created_at
  loop
    update public.flea_markets
       set slug = public.pick_flea_market_slug(r.name, r.city, r.id)
     where id = r.id;
  end loop;
end $$;
