-- Atomic replacement of opening_hour_rules for a single market.
-- Implicit transaction: all-or-nothing. Removes the partial-failure
-- window where the old admin-market-edit / FleaMarketRepository.update
-- could DELETE all rules and then fail the INSERT, leaving the market
-- with zero hours and blocking future publish.

create or replace function public.replace_opening_hours_atomic(
  p_market_id uuid,
  p_rules jsonb  -- array of { type, day_of_week, anchor_date, open_time, close_time }
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule jsonb;
begin
  -- Authorization: caller must be either the market organizer OR an admin.
  -- Check both — service-role calls (admin) bypass auth.uid() check.
  if auth.uid() is not null then
    perform 1 from flea_markets
      where id = p_market_id
        and (organizer_id = auth.uid() or public.is_admin(auth.uid()));
    if not found then
      raise exception 'not_authorized' using errcode = 'P0001';
    end if;
  end if;

  -- Atomic replace
  delete from opening_hour_rules where flea_market_id = p_market_id;

  if jsonb_array_length(p_rules) > 0 then
    for v_rule in select * from jsonb_array_elements(p_rules)
    loop
      insert into opening_hour_rules (
        flea_market_id, type, day_of_week, anchor_date, open_time, close_time
      ) values (
        p_market_id,
        v_rule->>'type',
        (v_rule->>'day_of_week')::smallint,
        (v_rule->>'anchor_date')::date,
        (v_rule->>'open_time')::time,
        (v_rule->>'close_time')::time
      );
    end loop;
  end if;
end;
$$;

grant execute on function public.replace_opening_hours_atomic to authenticated, service_role;
