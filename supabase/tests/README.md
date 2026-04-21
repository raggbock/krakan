# Supabase tests

## `rls.sql` — Row Level Security regression suite

Covers every policy rewritten in migrations `00011_advisor_fixes.sql` and
`00012_consolidate_rls_policies.sql`. The script wraps setup + assertions
+ cleanup in a single transaction and ends with `ROLLBACK`, so it leaves
the database untouched and is safe to re-run on any environment
(including production).

### What it verifies

- **anon** can read published markets, cannot read drafts, bookings,
  stripe accounts, or unpublished routes
- **anon** cannot insert bookings or update any market
- **user A** (Bob) cannot see user B's drafts, update or delete another
  user's market, or transition their own booking straight to confirmed
- **user A** can cancel their own pending booking
- **user A** cannot insert a market attributed to someone else
- **organizer** can see and confirm pending bookings on their own
  markets, but cannot cancel a booking (that's the booker's action)
- **organizer** can insert tables on their own market, not on another
  organizer's market

### How to run

Via the Supabase CLI:

```sh
supabase db execute -f supabase/tests/rls.sql
```

Or paste the file contents into **SQL editor → Run** in the Supabase
dashboard.

Or over `psql`:

```sh
psql "$SUPABASE_DB_URL" -f supabase/tests/rls.sql
```

### Passing output

```
 rls_tests
-----------
 ok
(1 row)

ROLLBACK
```

### Failing output

Any assertion failure raises an exception with `RLS: <description>` and
the transaction aborts — no cleanup needed.

### When to re-run

- After touching any migration under `supabase/migrations/` that mentions
  a policy, function, or bucket
- Before every production-impacting deploy
- When onboarding a new environment / project
