# Opening Hours Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed opening hours with a rules-based system supporting weekly, biweekly, and date schedules plus exception dates.

**Architecture:** New `opening_hour_rules` and `opening_hour_exceptions` tables replace `opening_hours`. A rewritten `checkOpeningHours()` evaluates rules dynamically. `getUpcomingOpenDates()` generates upcoming dates for display. The UI uses a stepped flow: pick schedule type → fill in details.

**Tech Stack:** Supabase (Postgres + RLS), TypeScript, React, TDD with Vitest

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/00004_opening_hour_rules.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Create new tables
create table public.opening_hour_rules (
  id uuid primary key default gen_random_uuid(),
  flea_market_id uuid not null references public.flea_markets(id) on delete cascade,
  type text not null check (type in ('weekly', 'biweekly', 'date')),
  day_of_week smallint check (day_of_week between 0 and 6),
  anchor_date date,
  open_time time not null,
  close_time time not null,
  created_at timestamptz not null default now(),
  constraint opening_hour_rules_times_valid check (close_time > open_time),
  constraint opening_hour_rules_weekly_day check (
    type != 'weekly' or day_of_week is not null
  ),
  constraint opening_hour_rules_biweekly check (
    type != 'biweekly' or (day_of_week is not null and anchor_date is not null)
  ),
  constraint opening_hour_rules_date check (
    type != 'date' or anchor_date is not null
  )
);

create index opening_hour_rules_market_idx on public.opening_hour_rules (flea_market_id);

create table public.opening_hour_exceptions (
  id uuid primary key default gen_random_uuid(),
  flea_market_id uuid not null references public.flea_markets(id) on delete cascade,
  date date not null,
  reason text,
  created_at timestamptz not null default now()
);

create index opening_hour_exceptions_market_idx on public.opening_hour_exceptions (flea_market_id);

-- Migrate existing data
insert into public.opening_hour_rules (flea_market_id, type, day_of_week, anchor_date, open_time, close_time, created_at)
select
  flea_market_id,
  case when day_of_week is not null then 'weekly' else 'date' end,
  day_of_week,
  date,
  open_time,
  close_time,
  created_at
from public.opening_hours;

-- Drop old table
drop table public.opening_hours;

-- RLS for opening_hour_rules
alter table public.opening_hour_rules enable row level security;

create policy "Rules viewable with market"
  on public.opening_hour_rules for select
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id
        and (fm.published_at is not null or fm.organizer_id = auth.uid())
    )
  );

create policy "Organizer manages rules"
  on public.opening_hour_rules for all
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id
        and fm.organizer_id = auth.uid()
    )
  );

-- RLS for opening_hour_exceptions
alter table public.opening_hour_exceptions enable row level security;

create policy "Exceptions viewable with market"
  on public.opening_hour_exceptions for select
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id
        and (fm.published_at is not null or fm.organizer_id = auth.uid())
    )
  );

create policy "Organizer manages exceptions"
  on public.opening_hour_exceptions for all
  using (
    exists (
      select 1 from public.flea_markets fm
      where fm.id = flea_market_id
        and fm.organizer_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply migration to Supabase**

Run: `supabase db push` or apply via Supabase MCP `apply_migration` tool.

- [ ] **Step 3: Verify migration**

Run via `execute_sql`:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'opening_hour_rules' ORDER BY ordinal_position;
```

Expected: id, flea_market_id, type, day_of_week, anchor_date, open_time, close_time, created_at

```sql
SELECT count(*) FROM opening_hour_rules;
```

Expected: Same count as old `opening_hours` table had.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00004_opening_hour_rules.sql
git commit -m "feat: add opening_hour_rules and exceptions tables, migrate data"
```

---

### Task 2: Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add new types to types.ts**

Add after the existing `OpeningHoursItem` type (line ~49):

```typescript
export type RuleType = 'weekly' | 'biweekly' | 'date'

export type OpeningHourRule = {
  id: string
  type: RuleType
  day_of_week: number | null
  anchor_date: string | null
  open_time: string
  close_time: string
}

export type OpeningHourException = {
  id: string
  date: string
  reason: string | null
}
```

Update `FleaMarketDetails` (line ~23) to use new types:

```typescript
export type FleaMarketDetails = FleaMarket & {
  organizerName: string
  opening_hour_rules: OpeningHourRule[]
  opening_hour_exceptions: OpeningHourException[]
  flea_market_images: FleaMarketImage[]
}
```

Remove the old `OpeningHoursItem` type.

Update `CreateFleaMarketPayload` (line ~193) — replace the `openingHours` field:

```typescript
openingHours: {
  type: RuleType
  dayOfWeek: number | null
  anchorDate: string | null
  openTime: string
  closeTime: string
}[]
openingHourExceptions?: {
  date: string
  reason: string | null
}[]
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add OpeningHourRule and OpeningHourException types"
```

---

### Task 3: Rewrite Opening Hours Logic (TDD)

**Files:**
- Modify: `packages/shared/src/opening-hours.ts`
- Modify: `web/src/lib/opening-hours.test.ts`

- [ ] **Step 1: Write failing tests for checkOpeningHours**

Replace contents of `web/src/lib/opening-hours.test.ts`:

```typescript
import { checkOpeningHours, getUpcomingOpenDates } from '@fyndstigen/shared'
import type { OpeningHourRule, OpeningHourException } from '@fyndstigen/shared'

describe('checkOpeningHours', () => {
  it('returns closed when no rules', () => {
    const result = checkOpeningHours([], [], '2026-04-19')
    expect(result).toEqual({ isOpen: false, hours: null })
  })

  it('matches weekly rule by day_of_week', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    // 2026-04-18 is a Saturday (day_of_week=6)
    const result = checkOpeningHours(rules, [], '2026-04-18')
    expect(result).toEqual({ isOpen: true, hours: { open_time: '10:00', close_time: '16:00' } })
  })

  it('returns closed for non-matching weekly day', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    // 2026-04-20 is a Monday
    const result = checkOpeningHours(rules, [], '2026-04-20')
    expect(result).toEqual({ isOpen: false, hours: null })
  })

  it('matches biweekly rule on anchor week', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'biweekly', day_of_week: 6, anchor_date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
    ]
    // Anchor date itself (week 0, even)
    const result = checkOpeningHours(rules, [], '2026-04-18')
    expect(result).toEqual({ isOpen: true, hours: { open_time: '10:00', close_time: '16:00' } })
  })

  it('matches biweekly rule two weeks after anchor', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'biweekly', day_of_week: 6, anchor_date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
    ]
    // 2 weeks later = 2026-05-02 (Saturday)
    const result = checkOpeningHours(rules, [], '2026-05-02')
    expect(result).toEqual({ isOpen: true, hours: { open_time: '10:00', close_time: '16:00' } })
  })

  it('returns closed for biweekly on odd week', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'biweekly', day_of_week: 6, anchor_date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
    ]
    // 1 week later = 2026-04-25 (Saturday, odd week)
    const result = checkOpeningHours(rules, [], '2026-04-25')
    expect(result).toEqual({ isOpen: false, hours: null })
  })

  it('matches date rule exactly', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'date', day_of_week: null, anchor_date: '2026-07-04', open_time: '09:00', close_time: '14:00' },
    ]
    const result = checkOpeningHours(rules, [], '2026-07-04')
    expect(result).toEqual({ isOpen: true, hours: { open_time: '09:00', close_time: '14:00' } })
  })

  it('date rule takes priority over weekly', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
      { id: '2', type: 'date', day_of_week: null, anchor_date: '2026-04-18', open_time: '12:00', close_time: '14:00' },
    ]
    // 2026-04-18 is Saturday — date rule should win
    const result = checkOpeningHours(rules, [], '2026-04-18')
    expect(result).toEqual({ isOpen: true, hours: { open_time: '12:00', close_time: '14:00' } })
  })

  it('exception overrides all rules', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    const exceptions: OpeningHourException[] = [
      { id: 'e1', date: '2026-04-18', reason: 'Midsommar' },
    ]
    const result = checkOpeningHours(rules, exceptions, '2026-04-18')
    expect(result).toEqual({ isOpen: false, hours: null, exception: { reason: 'Midsommar' } })
  })

  it('exception with null reason', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    const exceptions: OpeningHourException[] = [
      { id: 'e1', date: '2026-04-18', reason: null },
    ]
    const result = checkOpeningHours(rules, exceptions, '2026-04-18')
    expect(result).toEqual({ isOpen: false, hours: null, exception: { reason: null } })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace loppan-web run test:run -- --reporter=verbose web/src/lib/opening-hours.test.ts`

Expected: FAIL — `checkOpeningHours` signature doesn't match.

- [ ] **Step 3: Write failing tests for getUpcomingOpenDates**

Append to `web/src/lib/opening-hours.test.ts`:

```typescript
describe('getUpcomingOpenDates', () => {
  it('returns empty for no rules', () => {
    const result = getUpcomingOpenDates([], [], '2026-04-18', 14)
    expect(result).toEqual([])
  })

  it('returns weekly dates within range', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    const result = getUpcomingOpenDates(rules, [], '2026-04-18', 14)
    expect(result).toEqual([
      { date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
      { date: '2026-04-25', open_time: '10:00', close_time: '16:00' },
    ])
  })

  it('skips exception dates', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    const exceptions: OpeningHourException[] = [
      { id: 'e1', date: '2026-04-25', reason: null },
    ]
    const result = getUpcomingOpenDates(rules, exceptions, '2026-04-18', 14)
    expect(result).toEqual([
      { date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
    ])
  })

  it('includes biweekly dates correctly', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'biweekly', day_of_week: 6, anchor_date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
    ]
    // 28 days = 4 weeks. Biweekly hits weeks 0, 2 → Apr 18, May 2
    const result = getUpcomingOpenDates(rules, [], '2026-04-18', 28)
    expect(result).toEqual([
      { date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
      { date: '2026-05-02', open_time: '10:00', close_time: '16:00' },
    ])
  })
})
```

- [ ] **Step 4: Rewrite opening-hours.ts**

Replace contents of `packages/shared/src/opening-hours.ts`:

```typescript
import type { OpeningHourRule, OpeningHourException } from './types'

export type OpeningHoursResult = {
  isOpen: boolean
  hours: { open_time: string; close_time: string } | null
  exception?: { reason: string | null }
}

export type UpcomingDate = {
  date: string
  open_time: string
  close_time: string
}

function toDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00')
}

function weeksBetween(a: string, b: string): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const diff = toDate(b).getTime() - toDate(a).getTime()
  return Math.round(diff / msPerWeek)
}

export function checkOpeningHours(
  rules: OpeningHourRule[],
  exceptions: OpeningHourException[],
  dateStr: string,
): OpeningHoursResult {
  // 1. Check exceptions first
  const exception = exceptions.find((e) => e.date === dateStr)
  if (exception) {
    return { isOpen: false, hours: null, exception: { reason: exception.reason } }
  }

  const dayOfWeek = toDate(dateStr).getDay()

  // 2. Date rules (highest priority)
  const dateRule = rules.find((r) => r.type === 'date' && r.anchor_date === dateStr)
  if (dateRule) {
    return { isOpen: true, hours: { open_time: dateRule.open_time, close_time: dateRule.close_time } }
  }

  // 3. Biweekly rules
  const biweeklyRule = rules.find((r) => {
    if (r.type !== 'biweekly' || r.day_of_week !== dayOfWeek || !r.anchor_date) return false
    const weeks = weeksBetween(r.anchor_date, dateStr)
    return weeks >= 0 && weeks % 2 === 0
  })
  if (biweeklyRule) {
    return { isOpen: true, hours: { open_time: biweeklyRule.open_time, close_time: biweeklyRule.close_time } }
  }

  // 4. Weekly rules
  const weeklyRule = rules.find((r) => r.type === 'weekly' && r.day_of_week === dayOfWeek)
  if (weeklyRule) {
    return { isOpen: true, hours: { open_time: weeklyRule.open_time, close_time: weeklyRule.close_time } }
  }

  return { isOpen: false, hours: null }
}

export function getUpcomingOpenDates(
  rules: OpeningHourRule[],
  exceptions: OpeningHourException[],
  fromDate: string,
  days: number,
): UpcomingDate[] {
  const results: UpcomingDate[] = []
  const start = toDate(fromDate)

  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const result = checkOpeningHours(rules, exceptions, dateStr)
    if (result.isOpen && result.hours) {
      results.push({ date: dateStr, open_time: result.hours.open_time, close_time: result.hours.close_time })
    }
  }

  return results
}
```

- [ ] **Step 5: Update exports in index.ts**

In `packages/shared/src/index.ts`, replace the opening-hours exports (lines 30-31):

```typescript
// Opening hours
export { checkOpeningHours, getUpcomingOpenDates } from './opening-hours'
export type { OpeningHoursResult, UpcomingDate } from './opening-hours'
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn workspace loppan-web run test:run -- --reporter=verbose web/src/lib/opening-hours.test.ts`

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/opening-hours.ts packages/shared/src/index.ts web/src/lib/opening-hours.test.ts
git commit -m "feat: rewrite checkOpeningHours with rules + exceptions + getUpcomingOpenDates"
```

---

### Task 4: Update API Layer

**Files:**
- Modify: `packages/shared/src/api/flea-markets.ts`

- [ ] **Step 1: Update the create method**

In `packages/shared/src/api/flea-markets.ts`, replace the opening hours insert block (lines ~80-93) in the `create` method:

```typescript
// Insert opening hour rules
if (payload.openingHours?.length) {
  const { error: ohError } = await supabase.from('opening_hour_rules').insert(
    payload.openingHours.map((oh) => ({
      flea_market_id: id,
      type: oh.type,
      day_of_week: oh.dayOfWeek,
      anchor_date: oh.anchorDate,
      open_time: oh.openTime,
      close_time: oh.closeTime,
    })),
  )
  if (ohError) throw ohError
}

// Insert opening hour exceptions
if (payload.openingHourExceptions?.length) {
  const { error: exError } = await supabase.from('opening_hour_exceptions').insert(
    payload.openingHourExceptions.map((ex) => ({
      flea_market_id: id,
      date: ex.date,
      reason: ex.reason,
    })),
  )
  if (exError) throw exError
}
```

- [ ] **Step 2: Update the update method**

In the `update` method (lines ~115-130), replace the opening hours delete+insert block:

```typescript
// Replace opening hour rules
await supabase.from('opening_hour_rules').delete().eq('flea_market_id', id)
if (payload.openingHours?.length) {
  const { error: ohError } = await supabase.from('opening_hour_rules').insert(
    payload.openingHours.map((oh) => ({
      flea_market_id: id,
      type: oh.type,
      day_of_week: oh.dayOfWeek,
      anchor_date: oh.anchorDate,
      open_time: oh.openTime,
      close_time: oh.closeTime,
    })),
  )
  if (ohError) throw ohError
}

// Replace opening hour exceptions
await supabase.from('opening_hour_exceptions').delete().eq('flea_market_id', id)
if (payload.openingHourExceptions?.length) {
  const { error: exError } = await supabase.from('opening_hour_exceptions').insert(
    payload.openingHourExceptions.map((ex) => ({
      flea_market_id: id,
      date: ex.date,
      reason: ex.reason,
    })),
  )
  if (exError) throw exError
}
```

- [ ] **Step 3: Update the details query**

In the `details` method, update the select to join the new tables instead of `opening_hours`:

Replace `opening_hours (*)` with:

```typescript
opening_hour_rules (*), opening_hour_exceptions (*)
```

- [ ] **Step 4: Update mappers if needed**

Check `packages/shared/src/api/mappers.ts` — update `FleaMarketDetailsRow` and `mapFleaMarketDetails` to use `opening_hour_rules` and `opening_hour_exceptions` instead of `opening_hours`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/api/flea-markets.ts packages/shared/src/api/mappers.ts packages/shared/src/types.ts
git commit -m "feat: update API layer for opening_hour_rules and exceptions"
```

---

### Task 5: Update Create Market UI

**Files:**
- Modify: `web/src/app/profile/create-market/page.tsx`
- Modify: `web/src/hooks/use-create-market.ts`

- [ ] **Step 1: Update use-create-market.ts types**

Replace `OpeningHourDraft` and update `CreateMarketInput`:

```typescript
type RuleDraft = {
  type: 'weekly' | 'biweekly' | 'date'
  dayOfWeek: number | null
  anchorDate: string | null
  openTime: string
  closeTime: string
}

type ExceptionDraft = {
  date: string
  reason: string | null
}

export type CreateMarketInput = {
  name: string
  description: string
  street: string
  zipCode: string
  city: string
  isPermanent: boolean
  organizerId: string
  tables: TableDraft[]
  images: File[]
  openingHours: RuleDraft[]
  openingHourExceptions: ExceptionDraft[]
  coordinates?: { latitude: number; longitude: number }
}
```

Update the `submit` function to pass `openingHourExceptions` to the API.

- [ ] **Step 2: Rewrite opening hours section in create-market page**

Replace the opening hours state (lines ~62-66) with:

```typescript
type RuleDraft = {
  type: 'weekly' | 'biweekly' | 'date'
  dayOfWeek: number | null
  anchorDate: string | null
  openTime: string
  closeTime: string
}

type ExceptionDraft = {
  date: string
  reason: string | null
}

const [rules, setRules] = useState<RuleDraft[]>([])
const [exceptions, setExceptions] = useState<ExceptionDraft[]>([])

// Form state for adding a rule
const [ruleType, setRuleType] = useState<'weekly' | 'biweekly' | 'date'>('weekly')
const [ohDay, setOhDay] = useState<string>('')
const [ohAnchorDate, setOhAnchorDate] = useState('')
const [ohOpen, setOhOpen] = useState('10:00')
const [ohClose, setOhClose] = useState('16:00')

// Form state for adding an exception
const [showExceptionForm, setShowExceptionForm] = useState(false)
const [exDate, setExDate] = useState('')
const [exReason, setExReason] = useState('')
```

- [ ] **Step 3: Build the stepped UI JSX**

Replace the opening hours form JSX (lines ~287-385) with:

**Step 1 — Type selector (three radio cards):**
```tsx
<div className="space-y-3">
  <p className="text-sm font-semibold text-espresso/70">Hur ofta har du öppet?</p>
  {([
    { value: 'weekly', label: 'Varje vecka', desc: 'T.ex. varje lördag och söndag 10–16' },
    { value: 'biweekly', label: 'Varannan vecka', desc: 'T.ex. varannan lördag med start 19 april' },
    { value: 'date', label: 'Specifika datum', desc: 'Välj enskilda dagar i kalendern' },
  ] as const).map((opt) => (
    <label
      key={opt.value}
      className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer ${
        ruleType === opt.value ? 'border-rust bg-rust/5' : 'border-cream-warm'
      }`}
    >
      <input
        type="radio"
        name="ruleType"
        value={opt.value}
        checked={ruleType === opt.value}
        onChange={() => setRuleType(opt.value)}
        className="accent-rust"
      />
      <div>
        <div className="font-semibold text-espresso">{opt.label}</div>
        <div className="text-xs text-espresso/50">{opt.desc}</div>
      </div>
    </label>
  ))}
</div>
```

**Step 2 — Details (conditional on ruleType):**
```tsx
<div className="mt-4 space-y-3">
  {/* Day picker — shown for weekly and biweekly */}
  {(ruleType === 'weekly' || ruleType === 'biweekly') && (
    <div>
      <label className="block text-sm font-semibold text-espresso/70 mb-1">Veckodag</label>
      <select value={ohDay} onChange={(e) => setOhDay(e.target.value)} className="vintage-input w-full">
        <option value="">Välj dag</option>
        <option value="1">Måndag</option>
        <option value="2">Tisdag</option>
        <option value="3">Onsdag</option>
        <option value="4">Torsdag</option>
        <option value="5">Fredag</option>
        <option value="6">Lördag</option>
        <option value="0">Söndag</option>
      </select>
    </div>
  )}

  {/* Anchor date — shown for biweekly */}
  {ruleType === 'biweekly' && (
    <div>
      <label className="block text-sm font-semibold text-espresso/70 mb-1">Första tillfället</label>
      <input type="date" value={ohAnchorDate} onChange={(e) => setOhAnchorDate(e.target.value)} className="vintage-input w-full" />
    </div>
  )}

  {/* Date picker — shown for date type */}
  {ruleType === 'date' && (
    <div>
      <label className="block text-sm font-semibold text-espresso/70 mb-1">Datum</label>
      <input type="date" value={ohAnchorDate} onChange={(e) => setOhAnchorDate(e.target.value)} className="vintage-input w-full" />
    </div>
  )}

  {/* Time inputs — always shown */}
  <div className="flex gap-3">
    <div className="flex-1">
      <label className="block text-sm font-semibold text-espresso/70 mb-1">Öppnar</label>
      <input type="time" value={ohOpen} onChange={(e) => setOhOpen(e.target.value)} className="vintage-input w-full" />
    </div>
    <div className="flex-1">
      <label className="block text-sm font-semibold text-espresso/70 mb-1">Stänger</label>
      <input type="time" value={ohClose} onChange={(e) => setOhClose(e.target.value)} className="vintage-input w-full" />
    </div>
  </div>

  <button type="button" onClick={addRule} disabled={!canAddRule} className="vintage-button w-full">
    + Lägg till
  </button>
</div>
```

**Add rule function:**
```typescript
const canAddRule =
  ohOpen && ohClose && ohOpen < ohClose &&
  (ruleType === 'date' ? !!ohAnchorDate : !!ohDay) &&
  (ruleType === 'biweekly' ? !!ohAnchorDate : true)

function addRule() {
  if (!canAddRule) return
  setRules((prev) => [
    ...prev,
    {
      type: ruleType,
      dayOfWeek: ruleType === 'date' ? null : parseInt(ohDay, 10),
      anchorDate: ohAnchorDate || null,
      openTime: ohOpen,
      closeTime: ohClose,
    },
  ])
  setOhDay('')
  setOhAnchorDate('')
  setOhOpen('10:00')
  setOhClose('16:00')
}
```

**Rules list + exception button:**
```tsx
{rules.length > 0 && (
  <div className="mt-4 space-y-2">
    <p className="text-sm font-semibold text-espresso/70">Dina öppettider</p>
    {rules.map((r, i) => (
      <div key={i} className="flex justify-between items-center p-3 bg-white border border-cream-warm rounded-lg">
        <div>
          <span className="font-semibold text-espresso">{formatRuleLabel(r)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-espresso text-sm">{r.openTime} – {r.closeTime}</span>
          <button type="button" onClick={() => setRules((prev) => prev.filter((_, j) => j !== i))} className="text-espresso/30 hover:text-rust">✕</button>
        </div>
      </div>
    ))}
  </div>
)}
```

**Helper for rule labels:**
```typescript
const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']

function formatRuleLabel(r: RuleDraft): string {
  if (r.type === 'weekly') return `Varje ${DAY_NAMES[r.dayOfWeek!]?.toLowerCase()}`
  if (r.type === 'biweekly') {
    const anchor = r.anchorDate ? ` från ${new Date(r.anchorDate + 'T12:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}` : ''
    return `Varannan ${DAY_NAMES[r.dayOfWeek!]?.toLowerCase()}${anchor}`
  }
  return new Date(r.anchorDate + 'T12:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}
```

**Exception form:**
```tsx
<button type="button" onClick={() => setShowExceptionForm(true)} className="mt-2 px-4 py-2 border border-dashed border-espresso/20 rounded-lg text-sm text-espresso/50 hover:border-rust hover:text-rust">
  + Lägg till undantag (stängd dag)
</button>

{showExceptionForm && (
  <div className="mt-2 p-3 border border-cream-warm rounded-lg space-y-2">
    <input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} className="vintage-input w-full" />
    <input type="text" value={exReason} onChange={(e) => setExReason(e.target.value)} placeholder="Anledning (valfritt)" className="vintage-input w-full" />
    <div className="flex gap-2">
      <button type="button" onClick={() => {
        if (!exDate) return
        setExceptions((prev) => [...prev, { date: exDate, reason: exReason || null }])
        setExDate('')
        setExReason('')
        setShowExceptionForm(false)
      }} className="vintage-button flex-1">Lägg till</button>
      <button type="button" onClick={() => setShowExceptionForm(false)} className="flex-1 text-sm text-espresso/50">Avbryt</button>
    </div>
  </div>
)}

{exceptions.map((ex, i) => (
  <div key={i} className="flex justify-between items-center p-3 bg-white border border-cream-warm rounded-lg">
    <span className="text-espresso">{ex.date} — <span className="text-rust">Stängt</span>{ex.reason ? ` (${ex.reason})` : ''}</span>
    <button type="button" onClick={() => setExceptions((prev) => prev.filter((_, j) => j !== i))} className="text-espresso/30 hover:text-rust">✕</button>
  </div>
))}
```

- [ ] **Step 4: Update form submission to pass rules + exceptions**

In the submit call, pass `openingHours: rules` and `openingHourExceptions: exceptions`.

- [ ] **Step 5: Run type-check**

Run: `yarn workspace loppan-web exec tsc --noEmit`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/app/profile/create-market/page.tsx web/src/hooks/use-create-market.ts
git commit -m "feat: stepped opening hours UI in create market form"
```

---

### Task 6: Update Edit Market UI

**Files:**
- Modify: `web/src/app/fleamarkets/[id]/edit/page.tsx`

- [ ] **Step 1: Update state and form to match create page**

Apply the same changes from Task 5 to the edit page:
- Replace `OpeningHourDraft` with `RuleDraft` and `ExceptionDraft` types
- Replace state variables with `rules`, `exceptions`, `ruleType`, `ohDay`, `ohAnchorDate`, `ohOpen`, `ohClose`, etc.
- Replace the opening hours form JSX with the stepped UI (same as Task 5)
- Add `formatRuleLabel` helper (same as Task 5)
- Add exception form (same as Task 5)

- [ ] **Step 2: Update loading from API**

Replace the opening hours mapping (lines ~109-118):

```typescript
if (market.opening_hour_rules?.length) {
  setRules(
    market.opening_hour_rules.map((r) => ({
      type: r.type as 'weekly' | 'biweekly' | 'date',
      dayOfWeek: r.day_of_week,
      anchorDate: r.anchor_date,
      openTime: r.open_time,
      closeTime: r.close_time,
    })),
  )
}
if (market.opening_hour_exceptions?.length) {
  setExceptions(
    market.opening_hour_exceptions.map((ex) => ({
      date: ex.date,
      reason: ex.reason,
    })),
  )
}
```

- [ ] **Step 3: Update form submission**

Pass `openingHours: rules` and `openingHourExceptions: exceptions` to the API update call.

- [ ] **Step 4: Run type-check**

Run: `yarn workspace loppan-web exec tsc --noEmit`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/fleamarkets/[id]/edit/page.tsx
git commit -m "feat: stepped opening hours UI in edit market form"
```

---

### Task 7: Update OpeningHoursCard

**Files:**
- Modify: `web/src/components/opening-hours-card.tsx`

- [ ] **Step 1: Rewrite component with two sections**

```tsx
import type { OpeningHourRule, OpeningHourException } from '@fyndstigen/shared'
import { getUpcomingOpenDates } from '@fyndstigen/shared'

const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']

function formatRuleSummary(rule: OpeningHourRule, upcoming: { date: string }[]): string {
  if (rule.type === 'weekly') return `Varje ${DAY_NAMES[rule.day_of_week!]?.toLowerCase()}`
  if (rule.type === 'biweekly') {
    const next = upcoming.find((u) => {
      const d = new Date(u.date + 'T12:00:00')
      return d.getDay() === rule.day_of_week && d > new Date()
    })
    const nextStr = next
      ? ` (nästa: ${new Date(next.date + 'T12:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })})`
      : ''
    return `Varannan ${DAY_NAMES[rule.day_of_week!]?.toLowerCase()}${nextStr}`
  }
  return new Date(rule.anchor_date + 'T12:00:00').toLocaleDateString('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function OpeningHoursCard({
  rules,
  exceptions,
}: {
  rules: OpeningHourRule[]
  exceptions: OpeningHourException[]
}) {
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = getUpcomingOpenDates(rules, exceptions, today, 90)

  // Separate recurring rules from date rules
  const recurringRules = rules.filter((r) => r.type === 'weekly' || r.type === 'biweekly')
  const dateRules = rules.filter((r) => r.type === 'date')

  // Build upcoming list including exceptions for display
  const upcomingWithExceptions = (() => {
    const dates = upcoming.slice(0, 10).map((u) => ({ ...u, closed: false, reason: null as string | null }))
    // Insert exception dates that fall within the range
    for (const ex of exceptions) {
      if (ex.date >= today && !dates.find((d) => d.date === ex.date)) {
        dates.push({ date: ex.date, open_time: '', close_time: '', closed: true, reason: ex.reason })
      }
    }
    dates.sort((a, b) => a.date.localeCompare(b.date))
    return dates.slice(0, 10)
  })()

  return (
    <div className="vintage-card p-6">
      <h2 className="font-display text-lg font-bold text-espresso mb-4">Öppettider</h2>

      {/* Rule summary */}
      {recurringRules.length > 0 && (
        <div className="space-y-2 mb-4">
          {recurringRules.map((rule) => (
            <div key={rule.id} className="flex justify-between items-center">
              <span className="text-espresso">{formatRuleSummary(rule, upcoming)}</span>
              <span className="font-medium tabular-nums text-espresso">
                {rule.open_time.slice(0, 5)} – {rule.close_time.slice(0, 5)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming dates */}
      {upcomingWithExceptions.length > 0 && (
        <div>
          {recurringRules.length > 0 && (
            <p className="text-sm font-semibold text-espresso/60 mb-2 mt-4">Kommande tillfällen</p>
          )}
          <div className="space-y-1">
            {upcomingWithExceptions.map((d) => (
              <div key={d.date} className="flex justify-between items-center text-sm">
                <span className="text-espresso/80">
                  {new Date(d.date + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                {d.closed ? (
                  <span className="text-rust font-medium">Stängt{d.reason ? ` (${d.reason})` : ''}</span>
                ) : (
                  <span className="tabular-nums text-espresso/80">{d.open_time.slice(0, 5)} – {d.close_time.slice(0, 5)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update market detail page to pass new props**

In `web/src/app/fleamarkets/[id]/page.tsx`, update the `OpeningHoursCard` usage:

Replace:
```tsx
{market.opening_hours?.length > 0 && (
  <OpeningHoursCard hours={market.opening_hours} />
)}
```

With:
```tsx
{(market.opening_hour_rules?.length > 0) && (
  <OpeningHoursCard
    rules={market.opening_hour_rules}
    exceptions={market.opening_hour_exceptions ?? []}
  />
)}
```

- [ ] **Step 3: Run type-check and tests**

Run: `yarn workspace loppan-web exec tsc --noEmit && yarn workspace loppan-web run test:run`

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/opening-hours-card.tsx web/src/app/fleamarkets/[id]/page.tsx
git commit -m "feat: two-section OpeningHoursCard with rule summary and upcoming dates"
```

---

### Task 8: Update use-create-market Tests

**Files:**
- Modify: `web/src/hooks/use-create-market.test.ts`

- [ ] **Step 1: Update test fixtures for new types**

Update `baseInput` to use the new rule format:

```typescript
const baseInput: CreateMarketInput = {
  name: 'Test Loppis',
  description: 'En bra loppis',
  street: 'Storgatan 1',
  zipCode: '111 22',
  city: 'Stockholm',
  isPermanent: true,
  organizerId: 'user-1',
  tables: [{ label: 'Bord 1', description: '', priceSek: 200, sizeDescription: '2x1m' }],
  images: [new File(['img'], 'photo.jpg', { type: 'image/jpeg' })],
  openingHours: [{ type: 'weekly', dayOfWeek: 6, anchorDate: null, openTime: '10:00', closeTime: '16:00' }],
  openingHourExceptions: [],
}
```

- [ ] **Step 2: Run all tests**

Run: `yarn workspace loppan-web run test:run`

Expected: All 292+ tests pass.

- [ ] **Step 3: Commit**

```bash
git add web/src/hooks/use-create-market.test.ts
git commit -m "test: update use-create-market tests for rule-based opening hours"
```

---

### Task 9: Manual Smoke Test

- [ ] **Step 1: Start dev server**

Run: `yarn workspace loppan-web run dev`

- [ ] **Step 2: Test create market flow**

1. Navigate to `/profile/create-market`
2. In step 1 (öppettider), select "Varje vecka" → add "Lördag 10:00–16:00"
3. Switch to "Varannan vecka" → add "Söndag 11:00–15:00 från 19 april"
4. Add an exception: "21 juni — Midsommar"
5. Complete market creation
6. Verify the market detail page shows rule summary + upcoming dates

- [ ] **Step 3: Test edit market flow**

1. Navigate to the created market's edit page
2. Verify existing rules are loaded correctly
3. Add/remove a rule
4. Save and verify changes persist

- [ ] **Step 4: Commit any fixes discovered during smoke test**

```bash
git add -A
git commit -m "fix: address issues found during opening hours smoke test"
```
