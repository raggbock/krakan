-- Migration: trigger to keep flea_markets.is_permanent in sync with weekly rules
--
-- Invariant: a market with at least one type='weekly' opening_hour_rule is
-- permanent. The visible_flea_markets view depends on this — without it,
-- the market becomes published-but-invisible.
--
-- History: enforced manually in bulk-import-markets.mjs and scrape-rodakorset.mjs,
-- but enrich-opening-hours.mjs, enrich-with-google-places.mjs, and dedupe-markets.mjs
-- all insert weekly rules without patching is_permanent on the parent. 21 markets
-- ended up silently invisible (backfilled by hand on 2026-05-21). This trigger
-- moves the invariant into the schema so no future code path can violate it.
--
-- Direction: one-way. Setting is_permanent=true is safe (weekly hours imply a
-- permanent business). We never set it back to false from this trigger — if an
-- organizer legitimately changes a market to temporary they go through the
-- normal edit flow, which is responsible for removing the weekly rules.

create or replace function public.sync_is_permanent_from_weekly_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'weekly' then
    update public.flea_markets
       set is_permanent = true
     where id = new.flea_market_id
       and is_permanent = false;
  end if;
  return new;
end
$$;

comment on function public.sync_is_permanent_from_weekly_rule() is
  'After-insert/update trigger fn: a market that gains a weekly opening_hour_rule '
  'is permanent. Mirrors the invariant enforced ad-hoc in bulk-import scripts.';

drop trigger if exists opening_hour_rules_sync_is_permanent on public.opening_hour_rules;
create trigger opening_hour_rules_sync_is_permanent
after insert or update of type, flea_market_id on public.opening_hour_rules
for each row
execute function public.sync_is_permanent_from_weekly_rule();
