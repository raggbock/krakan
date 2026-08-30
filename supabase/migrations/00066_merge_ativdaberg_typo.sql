-- 'Åtivdaberg' is a transposition typo of 'Åtvidaberg' (the 'i' and 'v' are
-- swapped). Three published markets carry the typo while two carry the
-- correct spelling — all five are the same town (zip 597xx). Because the
-- /loppisar hub slug is derived from the city string via slugify_city, the
-- typo produced a second, separate hub page (ativdaberg) that split the
-- town's markets across two URLs instead of aggregating all five under
-- atvidaberg. Nobody searches the misspelling, so those three markets were
-- effectively invisible.
--
-- slug is set by a BEFORE INSERT trigger only (flea_markets_set_slug, see
-- 00063_auto_generate_market_slug.sql) — it does not fire on UPDATE, so this
-- city-only change does not touch the markets' own slug and breaks no
-- existing /loppis/<slug> URLs.
update public.flea_markets
   set city = 'Åtvidaberg'
 where city = 'Åtivdaberg'
   and is_deleted is not true;
