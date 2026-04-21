-- RLS integration tests
--
-- Exercises every rewritten policy from migrations 00011 + 00012 by
-- setting `role` and `request.jwt.claims` to simulate anon / user A /
-- user B / organizer requests. All setup is done inside a transaction
-- that ROLLBACKs at the end, so the script leaves the database
-- untouched and can be re-run indefinitely.
--
-- Run: copy-paste into Supabase SQL editor, or
--   supabase db execute -f supabase/tests/rls.sql
--
-- Success = the final SELECT 'ok' returns; any assertion failure raises
-- an exception and aborts.

begin;

-- ============================================
-- Setup (postgres role — bypasses RLS)
-- ============================================

-- Alice (aaaa...) organizes, Bob (bbbb...) is a regular visitor
insert into auth.users (id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
on conflict (id) do nothing;

-- handle_new_user trigger creates public.profiles rows; name them for clarity
update public.profiles set first_name = 'Alice' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
update public.profiles set first_name = 'Bob'   where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- Alice publishes one market and keeps one as a draft
insert into public.flea_markets (id, organizer_id, name, city, street, location, is_permanent, published_at)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Alice Published', 'Stockholm', 'Storgatan 1',
   extensions.st_point(18.07, 59.33)::geography, true, now()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Alice Draft',     'Stockholm', 'Storgatan 2',
   extensions.st_point(18.08, 59.34)::geography, true, null);

-- A table on the published market
insert into public.market_tables (id, flea_market_id, label, price_sek)
values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'Bord 1', 100);

-- Bob has a pending booking on Alice's table
insert into public.bookings
  (id, market_table_id, flea_market_id, booked_by, booking_date,
   status, price_sek, commission_sek, commission_rate)
values
  ('ffffffff-ffff-ffff-ffff-ffffffffffff',
   'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   current_date + 7, 'pending', 100, 12, 0.12);

-- A route owned by Bob, unpublished
insert into public.routes (id, name, created_by, is_published, is_deleted)
values
  ('99999999-9999-9999-9999-999999999999', 'Bob Draft Route',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false, false);


-- ============================================
-- ANON tests
-- ============================================

set local role anon;

do $$ begin
  if (select count(*) from public.flea_markets
      where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') <> 1 then
    raise exception 'RLS: anon should read a published market';
  end if;
end $$;

do $$ begin
  if (select count(*) from public.flea_markets
      where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') <> 0 then
    raise exception 'RLS: anon must NOT read draft market';
  end if;
end $$;

do $$ begin
  if (select count(*) from public.bookings) <> 0 then
    raise exception 'RLS: anon must NOT read any bookings';
  end if;
end $$;

do $$ begin
  if (select count(*) from public.stripe_accounts) <> 0 then
    raise exception 'RLS: anon must NOT read stripe accounts';
  end if;
end $$;

do $$ begin
  if (select count(*) from public.routes
      where id = '99999999-9999-9999-9999-999999999999') <> 0 then
    raise exception 'RLS: anon must NOT read unpublished route';
  end if;
end $$;

do $$ begin
  begin
    insert into public.bookings
      (market_table_id, flea_market_id, booked_by, booking_date,
       status, price_sek, commission_sek, commission_rate)
    values
      ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
       'cccccccc-cccc-cccc-cccc-cccccccccccc',
       'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
       current_date + 14, 'pending', 100, 12, 0.12);
    raise exception 'RLS: anon must NOT insert bookings';
  exception
    when insufficient_privilege then null;
    when check_violation        then null;
  end;
end $$;

do $$ declare c int; begin
  update public.flea_markets set name = 'anon-hack'
  where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  get diagnostics c = row_count;
  if c <> 0 then
    raise exception 'RLS: anon must NOT update any market';
  end if;
end $$;

reset role;


-- ============================================
-- BOB (visitor / booker) tests
-- ============================================

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';

do $$ begin
  if (select count(*) from public.flea_markets
      where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') <> 0 then
    raise exception 'RLS: Bob must NOT see Alice''s draft market';
  end if;
end $$;

do $$ begin
  if (select count(*) from public.bookings
      where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff') <> 1 then
    raise exception 'RLS: Bob should see own booking';
  end if;
end $$;

do $$ begin
  if (select count(*) from public.routes
      where id = '99999999-9999-9999-9999-999999999999') <> 1 then
    raise exception 'RLS: Bob should see own unpublished route';
  end if;
end $$;

do $$ declare c int; begin
  update public.flea_markets set name = 'bob-hack'
  where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  get diagnostics c = row_count;
  if c <> 0 then
    raise exception 'RLS: Bob must NOT update Alice''s market';
  end if;
end $$;

do $$ declare c int; begin
  delete from public.flea_markets
  where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  get diagnostics c = row_count;
  if c <> 0 then
    raise exception 'RLS: Bob must NOT delete Alice''s market';
  end if;
end $$;

-- Bob can cancel his own pending booking
do $$ declare c int; begin
  update public.bookings set status = 'cancelled'
  where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  get diagnostics c = row_count;
  if c <> 1 then
    raise exception 'RLS: Bob should be able to cancel own pending booking';
  end if;
end $$;

-- Bob must NOT be able to flip booking straight to confirmed (with_check blocks it)
-- First reset it under postgres (rollback happens regardless)
reset role;
update public.bookings set status = 'pending'
where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';

do $$ begin
  begin
    update public.bookings set status = 'confirmed'
    where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    -- WITH CHECK should reject; row count 0 is also acceptable (not visible)
    if (select status from public.bookings
        where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff') = 'confirmed' then
      raise exception 'RLS: Bob must NOT confirm own booking';
    end if;
  exception
    when check_violation       then null;
    when insufficient_privilege then null;
  end;
end $$;

-- Bob must not be able to create a market owned by Alice
do $$ begin
  begin
    insert into public.flea_markets (organizer_id, name, city, street, location, is_permanent)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'Fake', 'Stockholm', 'x',
            extensions.st_point(0,0)::geography, true);
    raise exception 'RLS: Bob must NOT insert market owned by Alice';
  exception
    when insufficient_privilege then null;
    when check_violation        then null;
  end;
end $$;

reset role;


-- ============================================
-- ALICE (organizer) tests
-- ============================================

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

do $$ begin
  if (select count(*) from public.flea_markets
      where organizer_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <> 2 then
    raise exception 'RLS: Alice should see both published and draft';
  end if;
end $$;

do $$ begin
  if (select count(*) from public.bookings
      where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff') <> 1 then
    raise exception 'RLS: organizer should see bookings on own market';
  end if;
end $$;

-- Reset booking to pending for organizer-confirm test
reset role;
update public.bookings set status = 'pending'
where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

do $$ declare c int; begin
  update public.bookings set status = 'confirmed'
  where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  get diagnostics c = row_count;
  if c <> 1 then
    raise exception 'RLS: organizer should confirm pending booking';
  end if;
end $$;

-- Organizer must NOT be able to set booking to 'cancelled' (not a valid organizer transition)
reset role;
update public.bookings set status = 'pending'
where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

do $$ begin
  begin
    update public.bookings set status = 'cancelled'
    where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    if (select status from public.bookings
        where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff') = 'cancelled' then
      raise exception 'RLS: organizer must NOT cancel a booking';
    end if;
  exception
    when check_violation        then null;
    when insufficient_privilege then null;
  end;
end $$;

-- Alice can insert a table on her own market
do $$ begin
  insert into public.market_tables (flea_market_id, label, price_sek)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Bord extra', 50);
end $$;

-- Alice must NOT be able to insert a table on a market she doesn't own
-- (Set up Bob's market quickly under postgres)
reset role;
insert into public.flea_markets (id, organizer_id, name, city, street, location, is_permanent, published_at)
values ('77777777-7777-7777-7777-777777777777',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'Bob Market', 'Malmö', 'y',
        extensions.st_point(13, 55)::geography, true, now());
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

do $$ begin
  begin
    insert into public.market_tables (flea_market_id, label, price_sek)
    values ('77777777-7777-7777-7777-777777777777', 'Hijack', 1);
    raise exception 'RLS: Alice must NOT insert table on Bob''s market';
  exception
    when insufficient_privilege then null;
    when check_violation        then null;
  end;
end $$;

reset role;


-- ============================================
-- Summary
-- ============================================

select 'ok' as rls_tests;

rollback;
