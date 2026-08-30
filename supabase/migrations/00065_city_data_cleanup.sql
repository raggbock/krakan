-- Collapse city names that differ only by casing. slugifyCity() lowercases,
-- so these produced one hub slug but two aggregated cities — the hub's
-- resolveCity().find() picked one and hid the other city's markets.
update public.flea_markets m
   set city = v.canonical
  from (values
    ('upplands väsby', 'Upplands Väsby')
  ) as v(nyckel, canonical)
 where lower(m.city) = v.nyckel
   and m.city <> v.canonical
   and m.is_deleted is not true;

-- 'Öst-Tegs industriområde' is a district of Umeå that was parsed into the
-- city column. The market is PMU Second Hand on Lärlingsgatan in Umeå.
update public.flea_markets
   set city = 'Umeå'
 where city = 'Öst-Tegs industriområde'
   and is_deleted is not true;
