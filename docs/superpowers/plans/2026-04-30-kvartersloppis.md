# Kvartersloppis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "kvartersloppis" event type where any logged-in user can organize a neighborhood flea market and households apply with their home address. Free for all parties; visitors browse one event page with a map of approved stands.

**Architecture:** Two new tables (`block_sales`, `block_sale_stands`) modeled separately from `flea_markets` because stands have no tables, no bookings, and aren't individually indexed. Edge functions for guest application + organizer decisions, following existing `definePublicEndpoint`/`defineEndpoint` pattern. Anti-spam via email-confirm + honeypot + Cloudflare KV rate-limit. Discovery blends into existing /map and /search with a distinct lilac pin color.

**Tech Stack:** PostgreSQL + RLS, Supabase Edge Functions (Deno), Next.js 15 (Cloudflare Workers deploy), Zod contracts, React Query, Resend (email), Nominatim (geocoding), Cloudflare KV (rate-limit).

**Spec:** [`docs/superpowers/specs/2026-04-30-kvartersloppis-design.md`](../specs/2026-04-30-kvartersloppis-design.md)

---

## File map

**New (migrations):**
- `supabase/migrations/00043_block_sales.sql`

**New (shared logic):**
- `packages/shared/src/block-sale.ts` — slug, status transitions, validation
- `packages/shared/src/block-sale.test.ts`

**New (contracts):**
- `packages/shared/src/contracts/block-sale-create.ts`
- `packages/shared/src/contracts/block-sale-stand-apply.ts`
- `packages/shared/src/contracts/block-sale-stand-confirm.ts`
- `packages/shared/src/contracts/block-sale-decide.ts`
- `packages/shared/src/contracts/block-sale-stand-edit.ts`

**New (edge functions):**
- `supabase/functions/block-sale-create/index.ts` (+ test)
- `supabase/functions/block-sale-stand-apply/index.ts` (+ test)
- `supabase/functions/block-sale-stand-confirm/index.ts` (+ test)
- `supabase/functions/block-sale-decide/index.ts` (+ test)
- `supabase/functions/block-sale-stand-edit/index.ts` (+ test)
- `supabase/functions/block-sale-archive/index.ts` (cron)

**New (email):**
- `supabase/functions/_shared/email-templates/block-sale-confirm.ts`
- `supabase/functions/_shared/email-templates/block-sale-new-application.ts`
- `supabase/functions/_shared/email-templates/block-sale-approved.ts`
- `supabase/functions/_shared/email-templates/block-sale-rejected.ts`

**New (web routes):**
- `web/src/app/skapa/kvartersloppis/page.tsx`
- `web/src/app/kvartersloppis/[slug]/{page,layout}.tsx`
- `web/src/app/kvartersloppis/[slug]/admin/page.tsx`
- `web/src/app/kvartersloppis/[slug]/min-ansokan/page.tsx`

**New (web components/hooks):**
- `web/src/components/block-sale-{form,stand-form,queue,public-map,stand-panel}.tsx`
- `web/src/hooks/use-block-sale{,-stands}.ts`

**Modified:**
- `packages/shared/src/types.ts` — `BlockSale`, `BlockSaleStand`
- `packages/shared/src/endpoints.ts` — register 5 new endpoints
- `packages/shared/src/ports/server.ts` — add `listPublishedBlockSaleIds`, `getBlockSaleMeta`
- `packages/shared/src/adapters/{supabase-server,in-memory}.ts`
- `web/src/app/sitemap.ts` — include block_sales
- `web/src/app/map/...` — lilac pins for block_sales
- `web/src/app/search/...` — mix in block_sales
- `web/src/app/loppisar/[city]/page.tsx` — block_sale section
- `web/src/lib/{query-keys,map-markers}.ts`

---

## Conventions

- All commands run from repo root unless noted.
- Tests: `cd web && node ../node_modules/vitest/vitest.mjs run` (web) or `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run` (shared).
- Edge function tests: `cd supabase/functions && deno test --allow-env --allow-net <function-dir>/index.test.ts`.
- Type check: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`.
- Commit per task. Use conventional-commit prefixes (`feat:`, `test:`, `refactor:`).

---

## Task 1: Migration — block_sales tables, RLS, view

**Files:**
- Create: `supabase/migrations/00043_block_sales.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Kvartersloppis: a single dated event where multiple households open
-- their home as a stand. Modeled separately from flea_markets because
-- stands have no tables/bookings and aren't individually indexed.

create table public.block_sales (
  id              uuid primary key default gen_random_uuid(),
  organizer_id    uuid not null references public.user_profiles(id) on delete cascade,
  name            text not null,
  slug            text not null unique,
  description     text,
  start_date      date not null,
  end_date        date not null,
  daily_open      time not null,
  daily_close     time not null,
  city            text not null,
  region          text,
  center_location geography(Point, 4326),
  published_at    timestamptz,
  is_deleted      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint block_sales_date_order check (end_date >= start_date),
  constraint block_sales_time_order check (daily_close > daily_open)
);

create index block_sales_organizer_idx on public.block_sales (organizer_id) where is_deleted = false;
create index block_sales_published_idx on public.block_sales (published_at, end_date) where is_deleted = false;
create index block_sales_city_idx on public.block_sales (lower(city)) where is_deleted = false and published_at is not null;

create table public.block_sale_stands (
  id                 uuid primary key default gen_random_uuid(),
  block_sale_id      uuid not null references public.block_sales(id) on delete cascade,
  user_id            uuid references auth.users(id) on delete set null,
  applicant_email    text not null,
  applicant_name     text not null,
  street             text not null,
  zip_code           text,
  city               text not null,
  location           geography(Point, 4326),
  description        text not null,
  status             text not null default 'pending'
    check (status in ('pending', 'confirmed', 'approved', 'rejected')),
  edit_token         text not null unique,
  email_confirmed_at timestamptz,
  decided_at         timestamptz,
  created_at         timestamptz not null default now(),
  constraint block_sale_stands_description_len check (char_length(description) <= 200)
);

create index block_sale_stands_event_idx on public.block_sale_stands (block_sale_id);
create index block_sale_stands_status_idx on public.block_sale_stands (block_sale_id, status);

-- Public read view: only approved stands on published events
create view public.visible_block_sale_stands with (security_invoker = true) as
  select s.*
  from public.block_sale_stands s
  join public.block_sales bs on bs.id = s.block_sale_id
  where s.status = 'approved'
    and bs.published_at is not null
    and bs.is_deleted = false;

-- RLS: block_sales
alter table public.block_sales enable row level security;

create policy block_sales_anon_read on public.block_sales
  for select to anon
  using (published_at is not null and is_deleted = false);

create policy block_sales_owner_all on public.block_sales
  for all to authenticated
  using (organizer_id = auth.uid())
  with check (organizer_id = auth.uid());

-- RLS: block_sale_stands
alter table public.block_sale_stands enable row level security;

create policy block_sale_stands_organizer_read on public.block_sale_stands
  for select to authenticated
  using (
    exists (
      select 1 from public.block_sales bs
      where bs.id = block_sale_id and bs.organizer_id = auth.uid()
    )
  );

create policy block_sale_stands_anon_read_approved on public.block_sale_stands
  for select to anon
  using (
    status = 'approved'
    and exists (
      select 1 from public.block_sales bs
      where bs.id = block_sale_id and bs.published_at is not null and bs.is_deleted = false
    )
  );

-- INSERT/UPDATE/DELETE blocked at table level — use edge functions only.
-- (No policies for these means no rows allowed.)

-- updated_at trigger
create trigger block_sales_updated_at
  before update on public.block_sales
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase migration up`
Expected: migration `00043_block_sales` applied without errors.

- [ ] **Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/shared/src/types/supabase.generated.ts`
Expected: file updated, no diff in unrelated tables.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00043_block_sales.sql packages/shared/src/types/supabase.generated.ts
git commit -m "feat(db): add block_sales tables for kvartersloppis"
```

---

## Task 2: Shared types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add types**

Append to `packages/shared/src/types.ts`:

```typescript
export type BlockSaleStatus = 'draft' | 'published'

export type BlockSale = {
  id: string
  organizerId: string
  name: string
  slug: string
  description: string | null
  startDate: string  // ISO date
  endDate: string
  dailyOpen: string  // HH:MM
  dailyClose: string
  city: string
  region: string | null
  centerLocation: { latitude: number; longitude: number } | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type BlockSaleStandStatus = 'pending' | 'confirmed' | 'approved' | 'rejected'

export type BlockSaleStand = {
  id: string
  blockSaleId: string
  userId: string | null
  applicantEmail: string
  applicantName: string
  street: string
  zipCode: string | null
  city: string
  location: { latitude: number; longitude: number } | null
  description: string
  status: BlockSaleStandStatus
  emailConfirmedAt: string | null
  decidedAt: string | null
  createdAt: string
}
```

Re-export from `web/src/lib/api.ts` (find existing re-export block of `FleaMarket` and add the new types alongside).

- [ ] **Step 2: Type check**

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts web/src/lib/api.ts
git commit -m "feat(types): add BlockSale and BlockSaleStand types"
```

---

## Task 3: Pure logic — slug, status validation, multi-day expansion

**Files:**
- Create: `packages/shared/src/block-sale.ts`
- Create: `packages/shared/src/block-sale.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/shared/src/block-sale.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  generateBlockSaleSlug,
  expandEventDates,
  canTransitionStandStatus,
  validateBlockSaleInput,
} from './block-sale'

describe('generateBlockSaleSlug', () => {
  it('lowercases and dashes name + city + start_date', () => {
    expect(generateBlockSaleSlug('Rådmansgatan', 'Örebro', '2026-07-12'))
      .toBe('radmansgatan-orebro-2026-07-12')
  })

  it('strips diacritics', () => {
    expect(generateBlockSaleSlug('Sjöstaden', 'Göteborg', '2026-08-01'))
      .toBe('sjostaden-goteborg-2026-08-01')
  })

  it('truncates very long names', () => {
    const s = generateBlockSaleSlug('a'.repeat(100), 'Stockholm', '2026-01-01')
    expect(s.length).toBeLessThanOrEqual(80)
  })
})

describe('expandEventDates', () => {
  it('returns one date for single-day event', () => {
    expect(expandEventDates('2026-07-12', '2026-07-12'))
      .toEqual(['2026-07-12'])
  })

  it('returns range for multi-day event', () => {
    expect(expandEventDates('2026-07-12', '2026-07-14'))
      .toEqual(['2026-07-12', '2026-07-13', '2026-07-14'])
  })

  it('throws on inverted range', () => {
    expect(() => expandEventDates('2026-07-14', '2026-07-12')).toThrow()
  })
})

describe('canTransitionStandStatus', () => {
  it('allows pending → confirmed', () => {
    expect(canTransitionStandStatus('pending', 'confirmed')).toBe(true)
  })
  it('allows confirmed → approved', () => {
    expect(canTransitionStandStatus('confirmed', 'approved')).toBe(true)
  })
  it('allows confirmed → rejected', () => {
    expect(canTransitionStandStatus('confirmed', 'rejected')).toBe(true)
  })
  it('forbids pending → approved (must confirm email first)', () => {
    expect(canTransitionStandStatus('pending', 'approved')).toBe(false)
  })
  it('forbids approved → pending', () => {
    expect(canTransitionStandStatus('approved', 'pending')).toBe(false)
  })
})

describe('validateBlockSaleInput', () => {
  const valid = {
    name: 'Kvartersloppis Rådmansgatan',
    description: 'Stort kvartersloppis med många stånd',
    startDate: '2026-07-12',
    endDate: '2026-07-12',
    dailyOpen: '10:00',
    dailyClose: '15:00',
    city: 'Örebro',
  }

  it('passes valid input', () => {
    expect(validateBlockSaleInput(valid).ok).toBe(true)
  })

  it('rejects start_date in past', () => {
    const past = { ...valid, startDate: '2020-01-01', endDate: '2020-01-01' }
    expect(validateBlockSaleInput(past).ok).toBe(false)
  })

  it('rejects end before start', () => {
    expect(validateBlockSaleInput({ ...valid, endDate: '2026-07-10' }).ok).toBe(false)
  })

  it('rejects close <= open', () => {
    expect(validateBlockSaleInput({ ...valid, dailyClose: '10:00' }).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run src/block-sale.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/shared/src/block-sale.ts`:

```typescript
import type { BlockSaleStandStatus } from './types'

export function generateBlockSaleSlug(name: string, city: string, startDate: string): string {
  const slugify = (s: string) => s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const namePart = slugify(name).slice(0, 40)
  const cityPart = slugify(city).slice(0, 25)
  return `${namePart}-${cityPart}-${startDate}`.slice(0, 80)
}

export function expandEventDates(startDate: string, endDate: string): string[] {
  const start = new Date(startDate + 'T00:00:00Z')
  const end = new Date(endDate + 'T00:00:00Z')
  if (end < start) throw new Error('endDate before startDate')
  const out: string[] = []
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

const STATUS_TRANSITIONS: Record<BlockSaleStandStatus, BlockSaleStandStatus[]> = {
  pending: ['confirmed'],
  confirmed: ['approved', 'rejected'],
  approved: [],
  rejected: [],
}

export function canTransitionStandStatus(from: BlockSaleStandStatus, to: BlockSaleStandStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export type BlockSaleInput = {
  name: string
  description?: string
  startDate: string
  endDate: string
  dailyOpen: string
  dailyClose: string
  city: string
}

export function validateBlockSaleInput(input: BlockSaleInput):
  | { ok: true }
  | { ok: false; reason: string }
{
  if (input.name.length < 3 || input.name.length > 120) return { ok: false, reason: 'name_length' }
  if (input.city.length < 1 || input.city.length > 80) return { ok: false, reason: 'city_length' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) return { ok: false, reason: 'start_date_format' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) return { ok: false, reason: 'end_date_format' }
  if (!/^\d{2}:\d{2}$/.test(input.dailyOpen)) return { ok: false, reason: 'open_format' }
  if (!/^\d{2}:\d{2}$/.test(input.dailyClose)) return { ok: false, reason: 'close_format' }

  const today = new Date().toISOString().slice(0, 10)
  if (input.startDate < today) return { ok: false, reason: 'start_in_past' }
  if (input.endDate < input.startDate) return { ok: false, reason: 'end_before_start' }
  if (input.dailyClose <= input.dailyOpen) return { ok: false, reason: 'close_before_open' }
  return { ok: true }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run src/block-sale.test.ts`
Expected: PASS — 4 describe blocks, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/block-sale.ts packages/shared/src/block-sale.test.ts
git commit -m "feat(shared): block-sale slug + status + validation logic"
```

---

## Task 4: Contracts (Zod schemas) + endpoint registration

**Files:**
- Create: `packages/shared/src/contracts/block-sale-create.ts`
- Create: `packages/shared/src/contracts/block-sale-stand-apply.ts`
- Create: `packages/shared/src/contracts/block-sale-stand-confirm.ts`
- Create: `packages/shared/src/contracts/block-sale-decide.ts`
- Create: `packages/shared/src/contracts/block-sale-stand-edit.ts`
- Modify: `packages/shared/src/endpoints.ts`

- [ ] **Step 1: Create `block-sale-create.ts`**

```typescript
import { z } from 'zod'

export const BlockSaleCreateInput = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dailyOpen: z.string().regex(/^\d{2}:\d{2}$/),
  dailyClose: z.string().regex(/^\d{2}:\d{2}$/),
  city: z.string().min(1).max(80),
  region: z.string().max(80).optional(),
  street: z.string().max(200).optional(),  // for geocoding center_location
  publish: z.boolean().default(false),
})

export const BlockSaleCreateOutput = z.object({
  ok: z.literal(true),
  slug: z.string(),
})
```

- [ ] **Step 2: Create `block-sale-stand-apply.ts`**

```typescript
import { z } from 'zod'

export const BlockSaleStandApplyInput = z.object({
  blockSaleId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(120),
  street: z.string().min(2).max(200),
  zipCode: z.string().max(10).optional(),
  city: z.string().min(1).max(80),
  description: z.string().min(1).max(200),
  // Honeypot — must be empty. Bots fill hidden fields; humans don't.
  website: z.string().max(0).optional(),
})

export const BlockSaleStandApplyOutput = z.object({
  ok: z.literal(true),
  standId: z.string().uuid(),
  // No edit token returned here — sent via email confirm step.
})
```

- [ ] **Step 3: Create `block-sale-stand-confirm.ts`**

```typescript
import { z } from 'zod'

export const BlockSaleStandConfirmInput = z.object({
  token: z.string().min(20),
})

export const BlockSaleStandConfirmOutput = z.object({
  ok: z.literal(true),
  standId: z.string().uuid(),
})
```

- [ ] **Step 4: Create `block-sale-decide.ts`**

```typescript
import { z } from 'zod'

export const BlockSaleDecideInput = z.object({
  blockSaleId: z.string().uuid(),
  standIds: z.array(z.string().uuid()).min(1).max(100),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),  // shown in rejection email
})

export const BlockSaleDecideOutput = z.object({
  ok: z.literal(true),
  decided: z.number(),
})
```

- [ ] **Step 5: Create `block-sale-stand-edit.ts`**

```typescript
import { z } from 'zod'

export const BlockSaleStandEditInput = z.object({
  token: z.string().min(20),
  street: z.string().min(2).max(200).optional(),
  description: z.string().min(1).max(200).optional(),
})

export const BlockSaleStandEditOutput = z.object({
  ok: z.literal(true),
})
```

- [ ] **Step 6: Register endpoints in `packages/shared/src/endpoints.ts`**

Find the existing endpoints object. Add:

```typescript
'block-sale.create': {
  path: 'block-sale-create',
  input: BlockSaleCreateInput,
  output: BlockSaleCreateOutput,
  auth: 'authenticated',
},
'block-sale.stand.apply': {
  path: 'block-sale-stand-apply',
  input: BlockSaleStandApplyInput,
  output: BlockSaleStandApplyOutput,
  auth: 'public',
},
'block-sale.stand.confirm': {
  path: 'block-sale-stand-confirm',
  input: BlockSaleStandConfirmInput,
  output: BlockSaleStandConfirmOutput,
  auth: 'public',
},
'block-sale.decide': {
  path: 'block-sale-decide',
  input: BlockSaleDecideInput,
  output: BlockSaleDecideOutput,
  auth: 'authenticated',
},
'block-sale.stand.edit': {
  path: 'block-sale-stand-edit',
  input: BlockSaleStandEditInput,
  output: BlockSaleStandEditOutput,
  auth: 'public',
},
```

Add corresponding imports at top.

- [ ] **Step 7: Type check**

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/contracts/block-sale-*.ts packages/shared/src/endpoints.ts
git commit -m "feat(contracts): add 5 block-sale endpoints"
```

---

## Task 5: Edge function — block-sale-create

**Files:**
- Create: `supabase/functions/block-sale-create/index.ts`
- Create: `supabase/functions/block-sale-create/index.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { assertEquals, assertRejects } from 'jsr:@std/assert'
import { createTestContext } from '../_shared/test-utils.ts'
import handler from './index.ts'

Deno.test('creates draft block_sale', async () => {
  const ctx = createTestContext({ userId: 'organizer-1' })
  const res = await handler(ctx, {
    name: 'Kvartersloppis Test',
    startDate: '2099-07-12',
    endDate: '2099-07-12',
    dailyOpen: '10:00',
    dailyClose: '15:00',
    city: 'Örebro',
    publish: false,
  })
  assertEquals(res.ok, true)
  assertEquals(typeof res.slug, 'string')

  const inserted = await ctx.admin
    .from('block_sales').select('*').eq('slug', res.slug).single()
  assertEquals(inserted.data.published_at, null)
  assertEquals(inserted.data.organizer_id, 'organizer-1')
})

Deno.test('rejects start_date in past', async () => {
  const ctx = createTestContext({ userId: 'organizer-1' })
  await assertRejects(() => handler(ctx, {
    name: 'Old', startDate: '2020-01-01', endDate: '2020-01-01',
    dailyOpen: '10:00', dailyClose: '15:00', city: 'Örebro', publish: false,
  }))
})

Deno.test('publishes when publish=true and geocodes when street provided', async () => {
  const ctx = createTestContext({ userId: 'organizer-1' })
  const res = await handler(ctx, {
    name: 'Kvartersloppis Sjöstaden',
    startDate: '2099-08-01',
    endDate: '2099-08-02',
    dailyOpen: '10:00',
    dailyClose: '16:00',
    city: 'Stockholm',
    street: 'Hammarby kaj 10',
    publish: true,
  })
  const inserted = await ctx.admin.from('block_sales').select('*').eq('slug', res.slug).single()
  assertEquals(inserted.data.published_at !== null, true)
  // center_location geocoded; coordinates non-null
  assertEquals(inserted.data.center_location !== null, true)
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd supabase/functions && deno test --allow-env --allow-net block-sale-create/`
Expected: FAIL — handler not found.

- [ ] **Step 3: Implement**

```typescript
import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { generateBlockSaleSlug, validateBlockSaleInput } from '@fyndstigen/shared/block-sale.ts'
import {
  BlockSaleCreateInput,
  BlockSaleCreateOutput,
} from '@fyndstigen/shared/contracts/block-sale-create.ts'
import { geocodeAddress } from '../_shared/geocode.ts'

export default defineEndpoint({
  name: 'block-sale-create',
  input: BlockSaleCreateInput,
  output: BlockSaleCreateOutput,
  auth: 'authenticated',
  handler: async ({ admin, user }, input) => {
    const v = validateBlockSaleInput(input)
    if (!v.ok) throw new HttpError(400, v.reason)

    const slug = await pickUniqueSlug(admin, generateBlockSaleSlug(input.name, input.city, input.startDate))

    let center: { lat: number; lng: number } | null = null
    if (input.street) {
      center = await geocodeAddress(`${input.street}, ${input.city}, Sweden`).catch(() => null)
    }

    const row: Record<string, unknown> = {
      organizer_id: user.id,
      name: input.name,
      slug,
      description: input.description ?? null,
      start_date: input.startDate,
      end_date: input.endDate,
      daily_open: input.dailyOpen,
      daily_close: input.dailyClose,
      city: input.city,
      region: input.region ?? null,
      published_at: input.publish ? new Date().toISOString() : null,
    }
    if (center) row.center_location = `POINT(${center.lng} ${center.lat})`

    const { error } = await admin.from('block_sales').insert(row)
    if (error) throw new Error(error.message)

    return { ok: true, slug }
  },
})

async function pickUniqueSlug(admin: any, base: string): Promise<string> {
  let candidate = base
  let i = 2
  while (true) {
    const { data } = await admin.from('block_sales').select('id').eq('slug', candidate).maybeSingle()
    if (!data) return candidate
    candidate = `${base}-${i++}`.slice(0, 80)
    if (i > 20) throw new Error('slug_collision')
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd supabase/functions && deno test --allow-env --allow-net block-sale-create/`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/block-sale-create/
git commit -m "feat(edge): block-sale-create endpoint"
```

---

## Task 6: Edge function — block-sale-stand-apply (anti-spam)

**Files:**
- Create: `supabase/functions/block-sale-stand-apply/index.ts`
- Create: `supabase/functions/block-sale-stand-apply/index.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { assertEquals, assertRejects } from 'jsr:@std/assert'
import { createTestContext } from '../_shared/test-utils.ts'
import handler from './index.ts'

const baseInput = {
  blockSaleId: '11111111-1111-1111-1111-111111111111',
  email: 'guest@example.com',
  name: 'Anna',
  street: 'Storgatan 5',
  city: 'Örebro',
  description: 'leksaker, böcker',
}

Deno.test('inserts pending stand and sends confirm email (anon)', async () => {
  const ctx = createTestContext({ userId: null, fixtures: { publishedBlockSale: baseInput.blockSaleId } })
  const res = await handler(ctx, baseInput)
  assertEquals(res.ok, true)

  const stand = await ctx.admin.from('block_sale_stands').select('*').eq('id', res.standId).single()
  assertEquals(stand.data.status, 'pending')
  assertEquals(stand.data.user_id, null)
  assertEquals(ctx.email.sent.length, 1)
  assertEquals(ctx.email.sent[0].to, 'guest@example.com')
})

Deno.test('skips email confirm and inserts confirmed stand when logged in', async () => {
  const ctx = createTestContext({ userId: 'guest-user-1', fixtures: { publishedBlockSale: baseInput.blockSaleId } })
  const res = await handler(ctx, { ...baseInput, email: 'guest@example.com' })
  const stand = await ctx.admin.from('block_sale_stands').select('*').eq('id', res.standId).single()
  assertEquals(stand.data.status, 'confirmed')
  assertEquals(stand.data.user_id, 'guest-user-1')
})

Deno.test('rejects honeypot hit', async () => {
  const ctx = createTestContext({ userId: null, fixtures: { publishedBlockSale: baseInput.blockSaleId } })
  await assertRejects(
    () => handler(ctx, { ...baseInput, website: 'http://spam.example' } as any),
    Error,
    'honeypot',
  )
})

Deno.test('rejects 6th application from same IP within an hour', async () => {
  const ctx = createTestContext({ userId: null, ip: '1.2.3.4', fixtures: { publishedBlockSale: baseInput.blockSaleId } })
  for (let i = 0; i < 5; i++) await handler(ctx, { ...baseInput, email: `g${i}@x.com` })
  await assertRejects(() => handler(ctx, { ...baseInput, email: 'g6@x.com' }), Error, 'rate_limited')
})

Deno.test('rejects when block_sale not published', async () => {
  const ctx = createTestContext({ userId: null, fixtures: { draftBlockSale: baseInput.blockSaleId } })
  await assertRejects(() => handler(ctx, baseInput), Error, 'not_found')
})
```

- [ ] **Step 2: Run, verify FAIL**

Run: `cd supabase/functions && deno test --allow-env --allow-net block-sale-stand-apply/`

- [ ] **Step 3: Implement**

```typescript
import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  BlockSaleStandApplyInput,
  BlockSaleStandApplyOutput,
} from '@fyndstigen/shared/contracts/block-sale-stand-apply.ts'
import { geocodeAddress } from '../_shared/geocode.ts'
import { sendEmail } from '../_shared/email.ts'
import { blockSaleConfirmEmail } from '../_shared/email-templates/block-sale-confirm.ts'
import { signEditToken } from '../_shared/block-sale-tokens.ts'
import { rateLimitByIp } from '../_shared/rate-limit.ts'

const RATE_LIMIT_PER_HOUR = 5

export default definePublicEndpoint({
  name: 'block-sale-stand-apply',
  input: BlockSaleStandApplyInput,
  output: BlockSaleStandApplyOutput,
  handler: async ({ admin, user, ip, env, origin }, input) => {
    if (input.website && input.website.length > 0) {
      throw new HttpError(400, 'honeypot')
    }
    await rateLimitByIp({ kv: env.RATE_LIMIT_KV, key: `block-sale-apply:${ip}`, max: RATE_LIMIT_PER_HOUR, windowSec: 3600 })

    // Verify block_sale is published
    const { data: bs } = await admin
      .from('block_sales').select('id, slug, organizer_id, name, end_date')
      .eq('id', input.blockSaleId).eq('is_deleted', false).maybeSingle()
    if (!bs || !bs.published_at) throw new HttpError(404, 'not_found')

    const geo = await geocodeAddress(`${input.street}, ${input.city}, Sweden`).catch(() => null)
    const editToken = await signEditToken({ standId: crypto.randomUUID() })

    const status = user ? 'confirmed' : 'pending'
    const row: Record<string, unknown> = {
      block_sale_id: input.blockSaleId,
      user_id: user?.id ?? null,
      applicant_email: input.email.toLowerCase(),
      applicant_name: input.name,
      street: input.street,
      zip_code: input.zipCode ?? null,
      city: input.city,
      description: input.description,
      status,
      edit_token: editToken,
      email_confirmed_at: user ? new Date().toISOString() : null,
    }
    if (geo) row.location = `POINT(${geo.lng} ${geo.lat})`

    const { data: inserted, error } = await admin.from('block_sale_stands').insert(row).select('id').single()
    if (error) throw new Error(error.message)

    if (!user) {
      const confirmUrl = `${origin}/api/block-sale-stand-confirm?token=${editToken}`
      await sendEmail({
        to: input.email,
        subject: `Bekräfta din ansökan till ${bs.name}`,
        html: blockSaleConfirmEmail({ eventName: bs.name, confirmUrl, editUrl: confirmUrl }),
      })
    } else {
      // Logged in: notify organizer right away (no confirm step)
      await notifyOrganizerNewApplication({ admin, blockSale: bs, applicantName: input.name })
    }

    return { ok: true, standId: inserted.id }
  },
})

async function notifyOrganizerNewApplication(args: { admin: any; blockSale: any; applicantName: string }) {
  // Implementation: lookup organizer email, send block-sale-new-application template
  // Detailed in Task 7.
}
```

- [ ] **Step 4: Run, verify PASS**

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/block-sale-stand-apply/
git commit -m "feat(edge): block-sale-stand-apply with honeypot + rate-limit + email-confirm"
```

---

## Task 7: Edge function — block-sale-stand-confirm

**Files:**
- Create: `supabase/functions/block-sale-stand-confirm/index.ts`
- Create: `supabase/functions/block-sale-stand-confirm/index.test.ts`
- Create: `supabase/functions/_shared/block-sale-tokens.ts`

- [ ] **Step 1: Token helper module**

```typescript
// supabase/functions/_shared/block-sale-tokens.ts
const KEY = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(Deno.env.get('BLOCK_SALE_TOKEN_SECRET') ?? 'dev-secret'),
  { name: 'HMAC', hash: 'SHA-256' },
  false, ['sign', 'verify'],
)

export async function signEditToken(payload: { standId: string }): Promise<string> {
  const body = btoa(JSON.stringify({ ...payload, iat: Date.now() }))
  const sig = await crypto.subtle.sign('HMAC', KEY, new TextEncoder().encode(body))
  return `${body}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`
}

export async function verifyEditToken(token: string): Promise<{ standId: string; iat: number } | null> {
  const [body, sigStr] = token.split('.')
  if (!body || !sigStr) return null
  const sig = Uint8Array.from(atob(sigStr), (c) => c.charCodeAt(0))
  const ok = await crypto.subtle.verify('HMAC', KEY, sig, new TextEncoder().encode(body))
  if (!ok) return null
  try { return JSON.parse(atob(body)) } catch { return null }
}
```

- [ ] **Step 2: Write failing test**

```typescript
// supabase/functions/block-sale-stand-confirm/index.test.ts
import { assertEquals, assertRejects } from 'jsr:@std/assert'
import { createTestContext } from '../_shared/test-utils.ts'
import { signEditToken } from '../_shared/block-sale-tokens.ts'
import handler from './index.ts'

Deno.test('confirms pending stand and notifies organizer', async () => {
  const ctx = createTestContext({ fixtures: { pendingStand: 'stand-1' } })
  const token = await signEditToken({ standId: 'stand-1' })
  const res = await handler(ctx, { token })
  assertEquals(res.ok, true)
  const updated = await ctx.admin.from('block_sale_stands').select('status').eq('id', 'stand-1').single()
  assertEquals(updated.data.status, 'confirmed')
  assertEquals(ctx.email.sent.length, 1)  // organizer notification
})

Deno.test('rejects invalid token', async () => {
  const ctx = createTestContext({ fixtures: { pendingStand: 'stand-1' } })
  await assertRejects(() => handler(ctx, { token: 'bogus.token' }), Error, 'invalid_token')
})
```

- [ ] **Step 3: Implement**

```typescript
import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  BlockSaleStandConfirmInput,
  BlockSaleStandConfirmOutput,
} from '@fyndstigen/shared/contracts/block-sale-stand-confirm.ts'
import { verifyEditToken } from '../_shared/block-sale-tokens.ts'
import { sendEmail } from '../_shared/email.ts'
import { blockSaleNewApplicationEmail } from '../_shared/email-templates/block-sale-new-application.ts'

export default definePublicEndpoint({
  name: 'block-sale-stand-confirm',
  input: BlockSaleStandConfirmInput,
  output: BlockSaleStandConfirmOutput,
  handler: async ({ admin, origin }, input) => {
    const payload = await verifyEditToken(input.token)
    if (!payload) throw new HttpError(400, 'invalid_token')

    const { data: stand } = await admin
      .from('block_sale_stands')
      .select('id, status, applicant_name, block_sales!inner(id, name, slug, organizer_id)')
      .eq('id', payload.standId).maybeSingle()
    if (!stand) throw new HttpError(404, 'not_found')
    if (stand.status === 'confirmed' || stand.status === 'approved') {
      // Idempotent — already confirmed
      return { ok: true, standId: stand.id }
    }
    if (stand.status === 'rejected') throw new HttpError(400, 'rejected')

    await admin.from('block_sale_stands').update({
      status: 'confirmed',
      email_confirmed_at: new Date().toISOString(),
    }).eq('id', stand.id)

    const { data: organizer } = await admin
      .from('user_profiles').select('email').eq('id', stand.block_sales.organizer_id).single()
    if (organizer?.email) {
      await sendEmail({
        to: organizer.email,
        subject: `Ny ansökan till ${stand.block_sales.name}`,
        html: blockSaleNewApplicationEmail({
          eventName: stand.block_sales.name,
          applicantName: stand.applicant_name,
          adminUrl: `${origin}/kvartersloppis/${stand.block_sales.slug}/admin`,
        }),
      })
    }

    return { ok: true, standId: stand.id }
  },
})
```

- [ ] **Step 4: Run tests PASS, commit**

```bash
git add supabase/functions/block-sale-stand-confirm/ supabase/functions/_shared/block-sale-tokens.ts
git commit -m "feat(edge): block-sale-stand-confirm + token signing helper"
```

---

## Task 8: Edge function — block-sale-decide

**Files:**
- Create: `supabase/functions/block-sale-decide/index.ts`
- Create: `supabase/functions/block-sale-decide/index.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { assertEquals, assertRejects } from 'jsr:@std/assert'
import { createTestContext } from '../_shared/test-utils.ts'
import handler from './index.ts'

Deno.test('approves stands and sends email', async () => {
  const ctx = createTestContext({
    userId: 'organizer-1',
    fixtures: { confirmedStands: ['stand-a', 'stand-b'], blockSaleId: 'bs-1', blockSaleOrganizer: 'organizer-1' },
  })
  const res = await handler(ctx, { blockSaleId: 'bs-1', standIds: ['stand-a', 'stand-b'], decision: 'approve' })
  assertEquals(res.decided, 2)
  const stands = await ctx.admin.from('block_sale_stands').select('status').in('id', ['stand-a', 'stand-b'])
  assertEquals(stands.data.every((s) => s.status === 'approved'), true)
  assertEquals(ctx.email.sent.length, 2)
})

Deno.test('rejects non-organizer', async () => {
  const ctx = createTestContext({
    userId: 'other-user',
    fixtures: { confirmedStands: ['stand-a'], blockSaleId: 'bs-1', blockSaleOrganizer: 'organizer-1' },
  })
  await assertRejects(() => handler(ctx, {
    blockSaleId: 'bs-1', standIds: ['stand-a'], decision: 'approve',
  }), Error, 'forbidden')
})

Deno.test('does not transition pending → approved (must be confirmed first)', async () => {
  const ctx = createTestContext({
    userId: 'organizer-1',
    fixtures: { pendingStands: ['stand-a'], blockSaleId: 'bs-1', blockSaleOrganizer: 'organizer-1' },
  })
  const res = await handler(ctx, { blockSaleId: 'bs-1', standIds: ['stand-a'], decision: 'approve' })
  assertEquals(res.decided, 0)  // pending stand skipped
})
```

- [ ] **Step 2: Run FAIL**

- [ ] **Step 3: Implement**

```typescript
import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { canTransitionStandStatus } from '@fyndstigen/shared/block-sale.ts'
import {
  BlockSaleDecideInput,
  BlockSaleDecideOutput,
} from '@fyndstigen/shared/contracts/block-sale-decide.ts'
import { sendEmail } from '../_shared/email.ts'
import { blockSaleApprovedEmail } from '../_shared/email-templates/block-sale-approved.ts'
import { blockSaleRejectedEmail } from '../_shared/email-templates/block-sale-rejected.ts'

export default defineEndpoint({
  name: 'block-sale-decide',
  input: BlockSaleDecideInput,
  output: BlockSaleDecideOutput,
  auth: 'authenticated',
  handler: async ({ admin, user, origin }, input) => {
    const { data: bs } = await admin
      .from('block_sales').select('id, name, slug, organizer_id')
      .eq('id', input.blockSaleId).maybeSingle()
    if (!bs) throw new HttpError(404, 'not_found')
    if (bs.organizer_id !== user.id) throw new HttpError(403, 'forbidden')

    const targetStatus = input.decision === 'approve' ? 'approved' : 'rejected'
    const { data: stands } = await admin
      .from('block_sale_stands')
      .select('id, status, applicant_email, applicant_name, edit_token')
      .in('id', input.standIds).eq('block_sale_id', bs.id)

    let decided = 0
    for (const s of stands ?? []) {
      if (!canTransitionStandStatus(s.status, targetStatus)) continue
      await admin.from('block_sale_stands').update({
        status: targetStatus,
        decided_at: new Date().toISOString(),
      }).eq('id', s.id)
      decided++

      const editUrl = `${origin}/kvartersloppis/${bs.slug}/min-ansokan?token=${s.edit_token}`
      const html = input.decision === 'approve'
        ? blockSaleApprovedEmail({ eventName: bs.name, eventUrl: `${origin}/kvartersloppis/${bs.slug}`, editUrl })
        : blockSaleRejectedEmail({ eventName: bs.name, reason: input.reason })
      await sendEmail({
        to: s.applicant_email,
        subject: input.decision === 'approve' ? `Du är godkänd till ${bs.name}!` : `Angående din ansökan till ${bs.name}`,
        html,
      })
    }

    return { ok: true, decided }
  },
})
```

- [ ] **Step 4: PASS, commit**

```bash
git add supabase/functions/block-sale-decide/
git commit -m "feat(edge): block-sale-decide with status transitions"
```

---

## Task 9: Edge function — block-sale-stand-edit

**Files:**
- Create: `supabase/functions/block-sale-stand-edit/index.ts`
- Create: `supabase/functions/block-sale-stand-edit/index.test.ts`

- [ ] **Step 1: Test**

```typescript
import { assertEquals, assertRejects } from 'jsr:@std/assert'
import { createTestContext } from '../_shared/test-utils.ts'
import { signEditToken } from '../_shared/block-sale-tokens.ts'
import handler from './index.ts'

Deno.test('edits description', async () => {
  const ctx = createTestContext({ fixtures: { confirmedStand: 'stand-1' } })
  const token = await signEditToken({ standId: 'stand-1' })
  await handler(ctx, { token, description: 'nytt sortiment' })
  const updated = await ctx.admin.from('block_sale_stands').select('description').eq('id', 'stand-1').single()
  assertEquals(updated.data.description, 'nytt sortiment')
})

Deno.test('re-geocodes when street changed', async () => {
  const ctx = createTestContext({ fixtures: { confirmedStand: 'stand-1' } })
  const token = await signEditToken({ standId: 'stand-1' })
  await handler(ctx, { token, street: 'Ny gatan 5' })
  const updated = await ctx.admin.from('block_sale_stands').select('street, location').eq('id', 'stand-1').single()
  assertEquals(updated.data.street, 'Ny gatan 5')
  assertEquals(updated.data.location !== null, true)  // geocoded
})

Deno.test('rejects edits to rejected stand', async () => {
  const ctx = createTestContext({ fixtures: { rejectedStand: 'stand-1' } })
  const token = await signEditToken({ standId: 'stand-1' })
  await assertRejects(() => handler(ctx, { token, description: 'x' }), Error, 'forbidden')
})
```

- [ ] **Step 2: Implement**

```typescript
import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  BlockSaleStandEditInput,
  BlockSaleStandEditOutput,
} from '@fyndstigen/shared/contracts/block-sale-stand-edit.ts'
import { verifyEditToken } from '../_shared/block-sale-tokens.ts'
import { geocodeAddress } from '../_shared/geocode.ts'

export default definePublicEndpoint({
  name: 'block-sale-stand-edit',
  input: BlockSaleStandEditInput,
  output: BlockSaleStandEditOutput,
  handler: async ({ admin }, input) => {
    const payload = await verifyEditToken(input.token)
    if (!payload) throw new HttpError(400, 'invalid_token')

    const { data: stand } = await admin
      .from('block_sale_stands').select('id, status, city')
      .eq('id', payload.standId).maybeSingle()
    if (!stand) throw new HttpError(404, 'not_found')
    if (stand.status === 'rejected') throw new HttpError(403, 'forbidden')

    const patch: Record<string, unknown> = {}
    if (input.description !== undefined) patch.description = input.description
    if (input.street !== undefined) {
      patch.street = input.street
      const geo = await geocodeAddress(`${input.street}, ${stand.city}, Sweden`).catch(() => null)
      if (geo) patch.location = `POINT(${geo.lng} ${geo.lat})`
    }

    if (Object.keys(patch).length === 0) return { ok: true }
    const { error } = await admin.from('block_sale_stands').update(patch).eq('id', stand.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  },
})
```

- [ ] **Step 3: PASS, commit**

```bash
git add supabase/functions/block-sale-stand-edit/
git commit -m "feat(edge): block-sale-stand-edit"
```

---

## Task 10: Email templates

**Files:**
- Create: `supabase/functions/_shared/email-templates/block-sale-confirm.ts`
- Create: `supabase/functions/_shared/email-templates/block-sale-new-application.ts`
- Create: `supabase/functions/_shared/email-templates/block-sale-approved.ts`
- Create: `supabase/functions/_shared/email-templates/block-sale-rejected.ts`

- [ ] **Step 1: Confirm template**

```typescript
// block-sale-confirm.ts
export function blockSaleConfirmEmail(args: { eventName: string; confirmUrl: string; editUrl: string }): string {
  return `
<p>Hej!</p>
<p>Tack för din ansökan till <strong>${escape(args.eventName)}</strong>. Klicka på länken nedan för att bekräfta din e-postadress — först då skickas ansökan till arrangören.</p>
<p><a href="${args.confirmUrl}">Bekräfta min ansökan</a></p>
<p>Hälsningar,<br>Fyndstigen</p>
  `.trim()
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
```

- [ ] **Step 2: New-application template (to organizer)**

```typescript
export function blockSaleNewApplicationEmail(args: { eventName: string; applicantName: string; adminUrl: string }): string {
  return `
<p>${escape(args.applicantName)} har ansökt om ett stånd på <strong>${escape(args.eventName)}</strong>.</p>
<p><a href="${args.adminUrl}">Granska ansökan</a></p>
  `.trim()
}
```

- [ ] **Step 3: Approved template**

```typescript
export function blockSaleApprovedEmail(args: { eventName: string; eventUrl: string; editUrl: string }): string {
  return `
<p>Du är godkänd till <strong>${escape(args.eventName)}</strong>!</p>
<p><a href="${args.eventUrl}">Se eventsidan</a></p>
<p>Du kan redigera din ansökan här: <a href="${args.editUrl}">Redigera</a></p>
<p>Tips: skapa ett Fyndstigen-konto med samma email så blir det enklare nästa gång.</p>
  `.trim()
}
```

- [ ] **Step 4: Rejected template**

```typescript
export function blockSaleRejectedEmail(args: { eventName: string; reason?: string }): string {
  return `
<p>Tack för ditt intresse för <strong>${escape(args.eventName)}</strong>. Tyvärr godtogs inte din ansökan.</p>
${args.reason ? `<p>Anledning: ${escape(args.reason)}</p>` : ''}
<p>Lycka till nästa gång!</p>
  `.trim()
}
```

- [ ] **Step 5: Add `escape` helper to one shared module if not already present, or inline as above (small enough). Commit.**

```bash
git add supabase/functions/_shared/email-templates/block-sale-*.ts
git commit -m "feat(email): kvartersloppis email templates"
```

---

## Task 11: Server data port — list + meta

**Files:**
- Modify: `packages/shared/src/ports/server.ts`
- Modify: `packages/shared/src/adapters/supabase-server.ts`
- Modify: `packages/shared/src/adapters/in-memory.ts`
- Modify: `packages/shared/src/adapters.test.ts`

- [ ] **Step 1: Extend port**

In `packages/shared/src/ports/server.ts` add:

```typescript
listPublishedBlockSaleIds(): Promise<Array<{ id: string; slug: string; updatedAt: string; endDate: string }>>

getBlockSaleMeta(id: string): Promise<{
  name: string
  description: string | null
  city: string
  region: string | null
  startDate: string
  endDate: string
  dailyOpen: string
  dailyClose: string
  centerLatitude: number | null
  centerLongitude: number | null
  publishedAt: string | null
  organizerId: string
  approvedStands: Array<{
    id: string
    street: string
    city: string
    description: string
    latitude: number | null
    longitude: number | null
  }>
} | null>

getBlockSaleIdBySlug(slug: string): Promise<string | null>
```

- [ ] **Step 2: Implement in `supabase-server.ts`**

```typescript
async getBlockSaleIdBySlug(slug) {
  const { data } = await supabase
    .from('block_sales').select('id')
    .eq('slug', slug).eq('is_deleted', false).maybeSingle()
  return (data?.id as string | undefined) ?? null
},

async listPublishedBlockSaleIds() {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('block_sales')
    .select('id, slug, updated_at, end_date')
    .eq('is_deleted', false)
    .not('published_at', 'is', null)
    .gte('end_date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
  return (data ?? []).map((r) => ({
    id: r.id, slug: r.slug, updatedAt: r.updated_at, endDate: r.end_date,
  }))
},

async getBlockSaleMeta(id) {
  const { data: bs } = await supabase
    .from('block_sales')
    .select(`
      name, description, city, region, start_date, end_date,
      daily_open, daily_close, published_at, organizer_id,
      ST_X(center_location::geometry) as center_lng,
      ST_Y(center_location::geometry) as center_lat,
      visible_block_sale_stands(id, street, city, description,
        ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat)
    `)
    .eq('id', id).eq('is_deleted', false).single()
  if (!bs) return null
  return {
    name: bs.name,
    description: bs.description,
    city: bs.city,
    region: bs.region,
    startDate: bs.start_date,
    endDate: bs.end_date,
    dailyOpen: (bs.daily_open as string).slice(0, 5),
    dailyClose: (bs.daily_close as string).slice(0, 5),
    centerLatitude: bs.center_lat ? Number(bs.center_lat) : null,
    centerLongitude: bs.center_lng ? Number(bs.center_lng) : null,
    publishedAt: bs.published_at,
    organizerId: bs.organizer_id,
    approvedStands: (bs.visible_block_sale_stands ?? []).map((s: any) => ({
      id: s.id, street: s.street, city: s.city, description: s.description,
      latitude: s.lat ? Number(s.lat) : null, longitude: s.lng ? Number(s.lng) : null,
    })),
  }
},
```

- [ ] **Step 3: Implement in-memory adapter to match shape (return `[]` for stands by default)**

- [ ] **Step 4: Add tests in `adapters.test.ts`**

Following the existing pattern for getMarketMeta — seed a block_sale + 2 approved stands and assert they come back through getBlockSaleMeta.

- [ ] **Step 5: Run shared tests**

Run: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/ports/server.ts packages/shared/src/adapters/ packages/shared/src/adapters.test.ts
git commit -m "feat(shared): server data port for block_sales"
```

---

## Task 12: Frontend — organizer create page

**Files:**
- Create: `web/src/app/skapa/kvartersloppis/page.tsx`
- Create: `web/src/components/block-sale-form.tsx`
- Create: `web/src/hooks/use-block-sale.ts`

- [ ] **Step 1: Hook**

```typescript
// web/src/hooks/use-block-sale.ts
'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { endpoints } from '@/lib/edge'
import { queryKeys } from '@/lib/query-keys'

export function useBlockSaleCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof endpoints['block-sale.create']['invoke']>[0]) =>
      endpoints['block-sale.create'].invoke(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.blockSales.all() }),
  })
}
```

Add `queryKeys.blockSales` to `web/src/lib/query-keys.ts`:

```typescript
export const queryKeys = {
  // ... existing
  blockSales: {
    all: () => ['blockSales'] as const,
    bySlug: (slug: string) => ['blockSales', 'slug', slug] as const,
    queue: (slug: string) => ['blockSales', 'queue', slug] as const,
  },
}
```

- [ ] **Step 2: Form component**

`web/src/components/block-sale-form.tsx` — controlled form with name, description, start_date, end_date, daily_open, daily_close, city, region, street, with submit + draft/publish toggle. Use existing form patterns from `web/src/app/skapa/page.tsx`. Display field-level errors from validateBlockSaleInput.

- [ ] **Step 3: Page**

```tsx
// web/src/app/skapa/kvartersloppis/page.tsx
'use client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { BlockSaleForm } from '@/components/block-sale-form'
import { useBlockSaleCreate } from '@/hooks/use-block-sale'

export default function CreateBlockSalePage() {
  const { user } = useAuth()
  const router = useRouter()
  const mut = useBlockSaleCreate()

  if (!user) return <p>Logga in för att skapa ett kvartersloppis.</p>

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="font-display text-3xl font-bold">Skapa kvartersloppis</h1>
      <BlockSaleForm
        onSubmit={async (input) => {
          const res = await mut.mutateAsync(input)
          router.push(`/kvartersloppis/${res.slug}/admin`)
        }}
        busy={mut.isPending}
        error={mut.error}
      />
    </div>
  )
}
```

- [ ] **Step 4: Add nav entry on `/skapa` page** alongside "Skapa loppis" button.

- [ ] **Step 5: Manual test**

Run: `cd web && pnpm dev`. Visit `/skapa/kvartersloppis`, fill form, submit. Verify redirect to `/kvartersloppis/<slug>/admin`.

- [ ] **Step 6: Commit**

```bash
git add web/src/app/skapa/kvartersloppis/ web/src/components/block-sale-form.tsx web/src/hooks/use-block-sale.ts web/src/lib/query-keys.ts
git commit -m "feat(web): organizer create-block-sale page"
```

---

## Task 13: Frontend — public event page + JSON-LD

**Files:**
- Create: `web/src/app/kvartersloppis/[slug]/page.tsx`
- Create: `web/src/app/kvartersloppis/[slug]/layout.tsx`
- Create: `web/src/components/block-sale-public-map.tsx`
- Create: `web/src/components/block-sale-stand-panel.tsx`

- [ ] **Step 1: Layout with metadata + JSON-LD**

```tsx
// web/src/app/kvartersloppis/[slug]/layout.tsx
import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createSupabaseServerData, expandEventDates } from '@fyndstigen/shared'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode }

const resolve = cache(async (slug: string) => {
  const sb = await createSupabaseServerClient()
  const port = createSupabaseServerData(sb)
  const id = await port.getBlockSaleIdBySlug(slug)
  if (!id) return null
  const meta = await port.getBlockSaleMeta(id)
  return meta ? { id, ...meta } : null
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const bs = await resolve(slug)
  if (!bs) return { title: 'Kvartersloppis hittades inte' }
  const isDraft = !bs.publishedAt
  return {
    title: `${bs.name} — Kvartersloppis i ${bs.city}`,
    description: bs.description?.slice(0, 160) ??
      `Kvartersloppis ${bs.startDate}${bs.endDate !== bs.startDate ? `–${bs.endDate}` : ''} i ${bs.city}.`,
    alternates: { canonical: `/kvartersloppis/${slug}` },
    ...(isDraft ? { robots: { index: false, follow: false } } : {}),
  }
}

export default async function Layout({ params, children }: Props) {
  const { slug } = await params
  const bs = await resolve(slug)
  if (!bs) notFound()

  const dates = expandEventDates(bs.startDate, bs.endDate)
  const events = dates.map((d) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${bs.name} (${d})`,
    startDate: `${d}T${bs.dailyOpen}`,
    endDate: `${d}T${bs.dailyClose}`,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: bs.name,
      address: { '@type': 'PostalAddress', addressLocality: bs.city, addressCountry: 'SE' },
      ...(bs.centerLatitude && bs.centerLongitude ? {
        geo: { '@type': 'GeoCoordinates', latitude: bs.centerLatitude, longitude: bs.centerLongitude },
      } : {}),
    },
    organizer: { '@type': 'Organization', name: 'Fyndstigen', url: 'https://fyndstigen.se' },
    url: `https://fyndstigen.se/kvartersloppis/${slug}`,
    ...(bs.description ? { description: bs.description.slice(0, 500) } : {}),
  }))

  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Fyndstigen', item: 'https://fyndstigen.se' },
      { '@type': 'ListItem', position: 2, name: 'Kvartersloppisar', item: 'https://fyndstigen.se/kvartersloppis' },
      { '@type': 'ListItem', position: 3, name: bs.city },
      { '@type': 'ListItem', position: 4, name: bs.name },
    ],
  }

  return (
    <>
      {events.map((e, i) => (
        <script key={i} type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(e).replace(/</g, '\\u003c') }} />
      ))}
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, '\\u003c') }} />
      {children}
    </>
  )
}
```

- [ ] **Step 2: Public map component**

`web/src/components/block-sale-public-map.tsx` — uses MapLibre/Mapbox (whatever existing map components use, e.g. `web/src/app/map/...`), renders one pin per approved stand with the kvartersloppis pin variant from `web/src/lib/map-markers.ts` (added in Task 16). Click on pin → emits selected stand id → parent shows StandPanel.

- [ ] **Step 3: Stand panel**

`web/src/components/block-sale-stand-panel.tsx` — slide-out panel with description + address + "Hitta hit (Maps)"-link. Anchor: `#stand-<id>` deeplink.

- [ ] **Step 4: Page**

```tsx
// web/src/app/kvartersloppis/[slug]/page.tsx
'use client'
import { useParams } from 'next/navigation'
import { useBlockSale } from '@/hooks/use-block-sale'
import { BlockSalePublicMap } from '@/components/block-sale-public-map'

export default function Page() {
  const { slug } = useParams<{ slug: string }>()
  const { data: bs } = useBlockSale(slug)
  if (!bs) return <p>Laddar…</p>

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{bs.name}</h1>
        <p className="text-espresso/70">
          {bs.startDate}{bs.endDate !== bs.startDate ? ` – ${bs.endDate}` : ''} · {bs.dailyOpen}–{bs.dailyClose} · {bs.city}
        </p>
        {bs.description && <p className="mt-2">{bs.description}</p>}
      </header>
      <BlockSalePublicMap stands={bs.approvedStands} center={bs.centerLatitude && bs.centerLongitude
        ? { lat: bs.centerLatitude, lng: bs.centerLongitude } : null} />
      <section>
        <a href={`/kvartersloppis/${slug}/ansok`} className="btn-primary">Ansök om eget stånd</a>
      </section>
    </div>
  )
}
```

Add `useBlockSale` to `web/src/hooks/use-block-sale.ts`:

```typescript
export function useBlockSale(slug: string) {
  return useQuery({
    queryKey: queryKeys.blockSales.bySlug(slug),
    queryFn: async () => {
      const res = await fetch(`/api/block-sale-public-meta?slug=${encodeURIComponent(slug)}`)
      if (!res.ok) throw new Error(String(res.status))
      return res.json()
    },
  })
}
```

(Add a Next API route at `web/src/app/api/block-sale-public-meta/route.ts` that thin-wraps `getBlockSaleMeta` for browser fetches.)

- [ ] **Step 5: Manual test + commit**

```bash
git add web/src/app/kvartersloppis/ web/src/components/block-sale-public-map.tsx web/src/components/block-sale-stand-panel.tsx web/src/app/api/block-sale-public-meta/
git commit -m "feat(web): public kvartersloppis page with map + JSON-LD"
```

---

## Task 14: Frontend — guest application form

**Files:**
- Create: `web/src/app/kvartersloppis/[slug]/ansok/page.tsx`
- Create: `web/src/components/block-sale-stand-form.tsx`

- [ ] **Step 1: Form component**

`web/src/components/block-sale-stand-form.tsx` with fields: email, name, street, zipCode, city, description (textarea, max 200 char counter), `<input name="website" hidden tabIndex={-1} aria-hidden="true">` for honeypot. Submit calls `endpoints['block-sale.stand.apply'].invoke`.

- [ ] **Step 2: Page**

```tsx
// web/src/app/kvartersloppis/[slug]/ansok/page.tsx
'use client'
import { useParams, useRouter } from 'next/navigation'
import { useBlockSale } from '@/hooks/use-block-sale'
import { BlockSaleStandForm } from '@/components/block-sale-stand-form'

export default function ApplyPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const { data: bs } = useBlockSale(slug)
  if (!bs) return null

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="font-display text-2xl font-bold">Ansök om stånd — {bs.name}</h1>
      <BlockSaleStandForm
        blockSaleId={bs.id}
        defaultCity={bs.city}
        onSuccess={() => router.push(`/kvartersloppis/${slug}/ansokt`)}
      />
    </div>
  )
}
```

Plus a static `web/src/app/kvartersloppis/[slug]/ansokt/page.tsx` with "Tack! Kolla din inkorg för bekräftelselänken." copy.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/kvartersloppis/[slug]/ansok/ web/src/app/kvartersloppis/[slug]/ansokt/ web/src/components/block-sale-stand-form.tsx
git commit -m "feat(web): guest application form with honeypot"
```

---

## Task 15: Frontend — organizer admin queue

**Files:**
- Create: `web/src/app/kvartersloppis/[slug]/admin/page.tsx`
- Create: `web/src/components/block-sale-queue.tsx`
- Create: `web/src/hooks/use-block-sale-stands.ts`

- [ ] **Step 1: Hook**

```typescript
// use-block-sale-stands.ts
export function useBlockSaleQueue(slug: string) {
  return useQuery({
    queryKey: queryKeys.blockSales.queue(slug),
    queryFn: async () => {
      const sb = createBrowserClient()  // existing helper
      const { data: bs } = await sb.from('block_sales').select('id').eq('slug', slug).single()
      if (!bs) return []
      const { data: stands } = await sb.from('block_sale_stands')
        .select('id, applicant_name, applicant_email, street, city, description, status, created_at, location')
        .eq('block_sale_id', bs.id).order('created_at', { ascending: false })
      return stands ?? []
    },
  })
}

export function useBlockSaleDecide() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ...) => endpoints['block-sale.decide'].invoke(input),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: queryKeys.blockSales.queue(vars.slug) }),
  })
}
```

- [ ] **Step 2: Queue component**

`web/src/components/block-sale-queue.tsx` — table-style list with checkbox per row, status badge (pending/confirmed/approved/rejected), applicant info, address, description. Bulk-action toolbar (sticky on top when ≥1 selected): "Godkänn valda" / "Avböj valda". Single-row buttons "Godkänn" / "Avböj". Mini-map showing all confirmed pins for spatial context.

- [ ] **Step 3: Page**

```tsx
// web/src/app/kvartersloppis/[slug]/admin/page.tsx
'use client'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useBlockSale } from '@/hooks/use-block-sale'
import { BlockSaleQueue } from '@/components/block-sale-queue'

export default function AdminPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const { data: bs } = useBlockSale(slug)
  if (!bs) return null
  if (!user || user.id !== bs.organizerId) return <p>Du har inte tillgång till den här sidan.</p>

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{bs.name} — administration</h1>
      </header>
      <BlockSaleQueue slug={slug} blockSaleId={bs.id} />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add web/src/app/kvartersloppis/[slug]/admin/ web/src/components/block-sale-queue.tsx web/src/hooks/use-block-sale-stands.ts
git commit -m "feat(web): organizer admin queue with bulk actions"
```

---

## Task 16: Discovery integration — sitemap, /map, /search, /loppisar/[city]

**Files:**
- Modify: `web/src/app/sitemap.ts`
- Modify: `web/src/lib/map-markers.ts`
- Modify: `web/src/app/map/...` (component using map-markers)
- Modify: `web/src/app/search/...` (or its data hook)
- Modify: `web/src/app/loppisar/[city]/page.tsx`

- [ ] **Step 1: Sitemap**

In `web/src/app/sitemap.ts` add after the routePages section:

```typescript
const blockSales = await server.listPublishedBlockSaleIds()
const blockSalePages: MetadataRoute.Sitemap = blockSales.map((bs) => ({
  url: `${baseUrl}/kvartersloppis/${bs.slug}`,
  lastModified: new Date(bs.updatedAt),
  changeFrequency: 'daily' as const,
  priority: 0.8,
}))

return [...staticPages, ...cityPages, ...marketPages, ...routePages, ...blockSalePages]
```

- [ ] **Step 2: Add lilac pin variant in `web/src/lib/map-markers.ts`**

Add a `kvartersloppis` variant alongside existing market variants — same SVG marker shape, `fill="#7c3aed"` (lilac) and a small house-cluster icon overlay.

- [ ] **Step 3: Render block_sales on `/map`**

Wherever `/map` page fetches markers, add a parallel fetch for `listPublishedBlockSaleIds` + `getBlockSaleMeta` (or a thin meta endpoint) and render with the kvartersloppis variant. Click → `/kvartersloppis/<slug>`.

- [ ] **Step 4: `/search` integration**

Find the search data layer (likely `web/src/app/search/...` or a hook) and merge published block_sales into the result list, sorted by upcoming `start_date`. Card variant with date span + city + stand count. Add filter chip "Bara kvartersloppis" / "Bara butiker".

- [ ] **Step 5: `/loppisar/[city]/page.tsx`**

Above the existing list, add:

```tsx
{blockSalesInCity.length > 0 && (
  <section className="mb-8">
    <h2 className="font-display text-xl font-bold">Kvartersloppisar i {resolved.canonicalName}</h2>
    <ul className="mt-2 space-y-2">
      {blockSalesInCity.map((bs) => (
        <li key={bs.id}>
          <a href={`/kvartersloppis/${bs.slug}`} className="link">
            {bs.name} · {bs.startDate}{bs.endDate !== bs.startDate ? `–${bs.endDate}` : ''}
          </a>
        </li>
      ))}
    </ul>
  </section>
)}
```

Fetch block_sales for that city via a new `listBlockSalesInCity(city)` port method, or filter `listPublishedBlockSaleIds` + `getBlockSaleMeta` (acceptable since block_sale count is low).

- [ ] **Step 6: Type check + tests**

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit` — expect 0 errors.
Run: `cd web && node ../node_modules/vitest/vitest.mjs run` — expect all green.

- [ ] **Step 7: Commit**

```bash
git add web/src/app/sitemap.ts web/src/lib/map-markers.ts web/src/app/map/ web/src/app/search/ web/src/app/loppisar/[city]/page.tsx
git commit -m "feat(web): discovery integration for kvartersloppis"
```

---

## Task 17: Archive cron + GDPR retention

**Files:**
- Create: `supabase/functions/block-sale-archive/index.ts`
- Create: `supabase/functions/block-sale-archive/index.test.ts`
- Create: `supabase/migrations/00044_block_sale_archive_cron.sql`

- [ ] **Step 1: Write failing test**

```typescript
import { assertEquals } from 'jsr:@std/assert'
import { createTestContext } from '../_shared/test-utils.ts'
import handler from './index.ts'

Deno.test('removes personuppgifter from stands older than 1 year', async () => {
  const ctx = createTestContext({ fixtures: {
    oldStand: { id: 'old', endDate: '2024-01-01', email: 'a@b.com', name: 'Alice' },
    recentStand: { id: 'recent', endDate: '2026-01-01', email: 'b@c.com', name: 'Bob' },
  } })
  await handler(ctx, {})
  const old = await ctx.admin.from('block_sale_stands').select('applicant_email, applicant_name').eq('id', 'old').single()
  assertEquals(old.data.applicant_email, '')
  assertEquals(old.data.applicant_name, '')

  const recent = await ctx.admin.from('block_sale_stands').select('applicant_email').eq('id', 'recent').single()
  assertEquals(recent.data.applicant_email, 'b@c.com')
})
```

- [ ] **Step 2: Implement**

```typescript
// block-sale-archive/index.ts
import { defineCronEndpoint } from '../_shared/cron-endpoint.ts'

export default defineCronEndpoint({
  name: 'block-sale-archive',
  handler: async ({ admin }) => {
    const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
    // Find stands whose parent block_sale ended over 1 year ago
    const { data: oldEvents } = await admin
      .from('block_sales').select('id').lt('end_date', cutoff)
    const ids = (oldEvents ?? []).map((e) => e.id)
    if (ids.length === 0) return { ok: true, anonymized: 0 }
    const { count } = await admin
      .from('block_sale_stands')
      .update({
        applicant_email: '',
        applicant_name: '',
        edit_token: '',  // also invalidate token
      }, { count: 'exact' })
      .in('block_sale_id', ids)
      .neq('applicant_email', '')
    return { ok: true, anonymized: count ?? 0 }
  },
})
```

- [ ] **Step 3: Schedule via pg_cron migration**

```sql
-- 00044_block_sale_archive_cron.sql
select cron.schedule(
  'block_sale_archive_daily',
  '0 4 * * *',
  $$ select net.http_post(
    url := current_setting('app.settings.functions_url') || '/block-sale-archive',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
  ); $$
);
```

(If pg_cron isn't already used for cron, follow the existing scheduling pattern instead — check repo for `cron.schedule` usage.)

- [ ] **Step 4: PASS, commit**

```bash
git add supabase/functions/block-sale-archive/ supabase/migrations/00044_block_sale_archive_cron.sql
git commit -m "feat(edge): block-sale archive cron for GDPR retention"
```

---

## Task 18: Sentry filter for block-sale 410-after-archive (small)

**Files:**
- Modify: `web/sentry.client.config.ts` (or wherever beforeSend lives)

- [ ] **Step 1: Add ignore-rule**

In Sentry init's `beforeSend`, ignore errors matching `Block sale archived` (these are expected after 30d-postevent when robots/random crawlers hit the URL).

This is also where the supabase Web Lock filter belongs (separate small fix from earlier). Add both at once:

```typescript
beforeSend(event) {
  const msg = event.exception?.values?.[0]?.value ?? ''
  if (/Lock .* was released because another request stole it/.test(msg)) return null
  if (/Block sale archived/.test(msg)) return null
  return event
},
```

- [ ] **Step 2: Commit**

```bash
git add web/sentry.client.config.ts
git commit -m "fix(sentry): filter benign supabase lock + block-sale archive errors"
```

---

## End-to-end smoke test (manual)

After all tasks land:

- [ ] Visit `/skapa/kvartersloppis` logged in → fill form → publish
- [ ] In another browser/incognito: visit `/kvartersloppis/<slug>` → verify Event JSON-LD via [Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Click "Ansök om eget stånd" → submit guest form
- [ ] Open confirm email → click link → verify status flips to confirmed
- [ ] As organizer: visit `/kvartersloppis/<slug>/admin` → see pending → click "Godkänn"
- [ ] Verify approval email received → click edit link → confirm edit page works
- [ ] Reload event page → verify approved stand pin appears on map
- [ ] Visit `/map` → verify lilac pin visible
- [ ] Visit `/search` and `/loppisar/<city>` → verify event listed
- [ ] Verify `/sitemap.xml` includes the slug

---

## Self-review log

- **Spec coverage:** All sections covered:
  - Data model → Task 1, Task 2
  - Edge functions → Tasks 5-9, 17
  - Email → Task 10
  - Frontend pages → Tasks 12-15
  - Discovery (map/search/sitemap/loppisar) → Task 16
  - SEO/JSON-LD → Task 13 (in layout)
  - Anti-spam → Task 6
  - GDPR retention → Task 17
  - Sentry filter (bonus) → Task 18
- **Status transitions:** `pending` → `confirmed` → `approved`|`rejected`. Direct table inserts blocked by RLS; only edge functions write. Logged-in users skip confirm step (status starts at `confirmed`).
- **Open questions resolved in plan:** slug uniqueness handled via `pickUniqueSlug` (Task 5). Email-confirm bypass for logged-in users (Task 6). 1-year hard delete of personuppgifter (Task 17).
