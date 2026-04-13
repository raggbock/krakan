# Opening Hours Rules — Design Spec

## Problem

Opening hours currently support only fixed weekdays (`day_of_week`) and one-off dates (`date`). Markets that open on recurring patterns like "every other Saturday" must manually enter each date. There's no way to mark exception days (e.g. closed for Midsommar).

## Solution

Replace the current `opening_hours` table with a rules-based system that supports three schedule types and date exceptions, with a stepped UI for creating rules.

---

## Data Model

### `opening_hour_rules`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| flea_market_id | uuid FK → flea_markets | ON DELETE CASCADE |
| type | text NOT NULL | `'weekly'` / `'biweekly'` / `'date'` |
| day_of_week | smallint | 0=Sunday..6=Saturday. Required for weekly/biweekly. |
| anchor_date | date | Start date for biweekly. Exact date for type='date'. |
| open_time | time NOT NULL | |
| close_time | time NOT NULL | CHECK: close_time > open_time |
| created_at | timestamptz | DEFAULT now() |

**Rule types:**
- `weekly` + `day_of_week: 6` → "varje lördag"
- `biweekly` + `day_of_week: 6` + `anchor_date: '2026-04-19'` → "varannan lördag med start 19 april"
- `date` + `anchor_date: '2026-07-04'` → enskilt datum

### `opening_hour_exceptions`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| flea_market_id | uuid FK → flea_markets | ON DELETE CASCADE |
| date | date NOT NULL | |
| reason | text | Optional, e.g. "Midsommar" |
| created_at | timestamptz | DEFAULT now() |

### Migration from `opening_hours`

- `day_of_week` rows → `opening_hour_rules` with `type: 'weekly'`
- `date` rows → `opening_hour_rules` with `type: 'date'`, `anchor_date` = date
- Drop `opening_hours` table after migration

### RLS Policies

Same pattern as current `opening_hours`:
- **View**: Anyone can read rules for published markets; organizer can read own unpublished
- **Edit**: Only market organizer can insert/update/delete rules and exceptions

---

## Calculation Logic

### `checkOpeningHours(rules, exceptions, dateStr) → OpeningHoursResult`

Priority order:
1. **Exceptions**: If date is in exceptions → `{ isOpen: false, exception: { reason } }`
2. **Date rules**: Exact match on `anchor_date` → `{ isOpen: true, hours }`
3. **Biweekly rules**: Calculate weeks since `anchor_date`. If even number of weeks AND `day_of_week` matches → `{ isOpen: true, hours }`
4. **Weekly rules**: `day_of_week` matches → `{ isOpen: true, hours }`
5. No match → `{ isOpen: false, hours: null }`

Return type:
```typescript
type OpeningHoursResult = {
  isOpen: boolean
  hours: { open_time: string; close_time: string } | null
  exception?: { reason: string | null }
}
```

### `getUpcomingOpenDates(rules, exceptions, fromDate, days) → UpcomingDate[]`

Iterates day-by-day from `fromDate` for `days` days, runs `checkOpeningHours` for each, returns open dates. Used for the "Kommande tillfällen" list on the market detail page.

```typescript
type UpcomingDate = {
  date: string
  open_time: string
  close_time: string
}
```

---

## UI — Organizer (Create/Edit Market)

### Step 1: Choose schedule type

Three radio options:
- **Varje vecka** — "T.ex. varje lördag och söndag 10–16"
- **Varannan vecka** — "T.ex. varannan lördag med start 19 april"
- **Specifika datum** — "Välj enskilda dagar i kalendern"

Selection determines which fields appear in step 2. Organizer can add multiple rules of different types to the same market.

### Step 2: Details (varies by type)

**Weekly:** day picker + open/close time
**Biweekly:** day picker + start date + open/close time
**Date:** date picker + open/close time

Each added rule appears in a summary list below the form with a remove button. Rules display as:
- "Varje lördag — 10:00–16:00"
- "Varannan lördag från 19 apr — 10:00–16:00"
- "4 jul 2026 — 09:00–14:00"

### Exceptions

A "+ Lägg till undantag (stängd dag)" button below the rules list. Opens a mini-form with date picker and optional reason field. Added exceptions display inline:
- "21 jun — Stängt (Midsommar)"

---

## UI — Visitor (Market Detail Page)

### OpeningHoursCard

Two sections:

**Öppettider** (rule summary):
```
Varje lördag          10:00 – 16:00
Varannan söndag       11:00 – 15:00  (nästa: 27 apr)
```

For biweekly rules, show "(nästa: [date])" to clarify when the next occurrence is.

**Kommande tillfällen** (generated from `getUpcomingOpenDates`, ~10 entries):
```
Lör 19 apr            10:00 – 16:00
Sön 20 apr            11:00 – 15:00
Lör 3 maj             10:00 – 16:00
Lör 21 jun            Stängt (Midsommar)
```

Exception dates appear inline with "Stängt" + reason.

---

## Affected Files

| File | Change |
|------|--------|
| `supabase/migrations/` | New migration: create tables, migrate data, drop old table |
| `packages/shared/src/types.ts` | New types: `OpeningHourRule`, `OpeningHourException` |
| `packages/shared/src/opening-hours.ts` | Rewrite `checkOpeningHours`, add `getUpcomingOpenDates` |
| `packages/shared/src/api/flea-markets.ts` | Update create/update to use rules + exceptions |
| `packages/shared/src/index.ts` | Export new types |
| `web/src/app/profile/create-market/page.tsx` | Stepped schedule type picker + rule form |
| `web/src/app/fleamarkets/[id]/edit/page.tsx` | Same stepped UI, load existing rules |
| `web/src/components/opening-hours-card.tsx` | Two-section display: rules + upcoming dates |
| `web/src/hooks/use-create-market.ts` | Handle rules + exceptions in submit flow |
| `web/src/lib/opening-hours.test.ts` | New tests for biweekly, exceptions, upcoming dates |

---

## Out of Scope

- Mobile edit UI (web-only for now)
- "First Sunday of month" patterns
- Multiple time slots per day (e.g. 10–12 and 14–16)
- Timezone handling (assumes Sweden)
