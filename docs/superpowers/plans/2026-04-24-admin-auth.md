# Admin-auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation of `/admin`: admin_users/admin_invites/admin_actions tables, edge functions for invite/accept/revoke, route-guarding in Next.js, and a minimal admin UI. Makes RFCs 2–4 (import, takeover, social kit) possible.

**Architecture:** Ports & adapters — new `AdminPort` in `@fyndstigen/shared` with in-memory + Supabase adapters. Mutations go through four new edge functions (`admin-invite-create/-accept/-revoke`, `admin-revoke`), each behind an `is_admin()` SQL guard. Next.js middleware does session-check; `/admin/layout.tsx` does admin-check and renders navigation. Resend sends invite mail.

**Tech Stack:** Supabase (Postgres + RLS + Edge Functions on Deno), Next.js 16 App Router, React Query, Resend, zod.

**Spec:** `docs/superpowers/specs/2026-04-24-admin-auth-design.md`.

---

## File Structure

**New files:**

- `supabase/migrations/00018_admin.sql` — tables + RLS + `is_admin()`
- `supabase/migrations/00019_admin_seed_bootstrap.sql` — placeholder seed
- `supabase/functions/_shared/email.ts` — Resend wrapper
- `supabase/functions/_shared/email-templates/admin-invite.ts` — mail template
- `supabase/functions/admin-invite-create/index.ts`
- `supabase/functions/admin-invite-accept/index.ts`
- `supabase/functions/admin-invite-revoke/index.ts`
- `supabase/functions/admin-revoke/index.ts`
- `supabase/functions/admin-*/index.test.ts` — Deno tests
- `packages/shared/src/ports/admin.ts` — AdminPort type
- `packages/shared/src/adapters/in-memory/admin.ts` + `.test.ts`
- `packages/shared/src/adapters/supabase/admin.ts` + `.test.ts`
- `packages/shared/src/contracts/admin-invite-create.ts` — zod input/output
- `packages/shared/src/contracts/admin-invite-accept.ts`
- `packages/shared/src/contracts/admin-invite-revoke.ts`
- `packages/shared/src/contracts/admin-revoke.ts`
- `web/src/hooks/use-admin.ts` — React Query hooks
- `web/src/app/admin/layout.tsx`
- `web/src/app/admin/page.tsx`
- `web/src/app/admin/settings/admins/page.tsx`
- `web/src/app/admin/invite/accept/page.tsx`

**Modified files:**

- `supabase/functions/deno.json` — ensure `@supabase/supabase-js` import (already fixed in e2e-foundation branch; rebase will carry it).
- `packages/shared/src/deps.ts` — add `admin: AdminPort`.
- `packages/shared/src/deps-factory.ts` — wire Supabase + in-memory adapters.
- `packages/shared/src/ports/index.ts` — export AdminPort.
- `packages/shared/src/index.ts` — re-export AdminPort type.
- `web/src/middleware.ts` — session-check for `/admin/*`.
- `SETUP-CHECKLIST.txt` — Resend DNS/SPF + seed-bootstrap step.

---

### Task 1: Migration — admin_users, admin_invites, admin_actions, is_admin()

**Files:**
- Create: `supabase/migrations/00018_admin.sql`

- [ ] **Step 1: Write migration**

```sql
-- 00018_admin.sql
-- Admin-auth foundation: admins table, invite machinery, audit trail.

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  revoked_at timestamptz,
  notes text
);

create index admin_users_active_idx on public.admin_users (user_id)
  where revoked_at is null;

create table public.admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  accepted_from_ip text,
  revoked_at timestamptz
);

create index admin_invites_token_hash_idx on public.admin_invites (token_hash);
create index admin_invites_pending_idx on public.admin_invites (email)
  where accepted_at is null and revoked_at is null;

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  action text not null,
  target_type text,
  target_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_actions_created_at_idx on public.admin_actions (created_at desc);
create index admin_actions_admin_user_idx on public.admin_actions (admin_user_id, created_at desc);

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = uid and revoked_at is null
  );
$$;

alter table public.admin_users enable row level security;
alter table public.admin_invites enable row level security;
alter table public.admin_actions enable row level security;

create policy admin_users_select on public.admin_users for select using (public.is_admin());
create policy admin_invites_select on public.admin_invites for select using (public.is_admin());
create policy admin_actions_select on public.admin_actions for select using (public.is_admin());
-- No insert/update/delete policies — all writes go through edge functions with service-role.
```

- [ ] **Step 2: Apply to local Supabase**

```bash
supabase db reset
```

Expected: migration applies without errors; `is_admin()` is callable.

- [ ] **Step 3: Smoke-test RLS in psql**

```bash
psql "$(supabase status --output json | jq -r '.DB_URL')" -c "select is_admin('00000000-0000-0000-0000-000000000000'::uuid);"
```

Expected: `false`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00018_admin.sql
git commit -m "feat(db): admin_users/admin_invites/admin_actions + is_admin()"
```

---

### Task 2: Seed-bootstrap migration (placeholder)

**Files:**
- Create: `supabase/migrations/00019_admin_seed_bootstrap.sql`

- [ ] **Step 1: Write placeholder migration**

```sql
-- 00019_admin_seed_bootstrap.sql
--
-- SEED THE FIRST ADMIN. This file ships with a placeholder UUID that will
-- intentionally fail to insert (foreign-key violation against auth.users).
-- Before running this migration against a real environment:
--
--   1. Ensure your auth user exists (sign up via /auth in the target env).
--   2. Replace the UUID below with your user_id (see SETUP-CHECKLIST).
--   3. Re-apply.
--
-- In CI/local dev where no auth.users row exists yet, this migration is a
-- no-op wrapped in a guard — it only runs when a matching auth.users row
-- exists for the configured UUID.

do $$
declare
  seed_uid uuid := '00000000-0000-0000-0000-000000000000'; -- REPLACE BEFORE PROD
begin
  if exists (select 1 from auth.users where id = seed_uid) then
    insert into public.admin_users (user_id, granted_by, notes)
    values (seed_uid, null, 'Initial seed')
    on conflict (user_id) do nothing;

    insert into public.admin_actions (admin_user_id, action, target_type, target_id, payload)
    values (seed_uid, 'admin.seed.bootstrap', 'admin_user', seed_uid::text, '{}'::jsonb);
  end if;
end $$;
```

- [ ] **Step 2: Update SETUP-CHECKLIST**

Append to `SETUP-CHECKLIST.txt`:

```
### Admin bootstrap
1. Sign in via /auth in the target environment to create your auth.users row.
2. Fetch your user_id:
     select id from auth.users where email = 'you@example.com';
3. Open supabase/migrations/00019_admin_seed_bootstrap.sql, replace the
   placeholder UUID in seed_uid, commit (or apply once as a remote execute
   without committing — preferred for prod).
4. Verify: select is_admin('<your-uid>');  -- should return true
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00019_admin_seed_bootstrap.sql SETUP-CHECKLIST.txt
git commit -m "feat(db): placeholder seed migration for first admin + docs"
```

---

### Task 3: Contracts — zod input/output for the four edge functions

**Files:**
- Create: `packages/shared/src/contracts/admin-invite-create.ts`
- Create: `packages/shared/src/contracts/admin-invite-accept.ts`
- Create: `packages/shared/src/contracts/admin-invite-revoke.ts`
- Create: `packages/shared/src/contracts/admin-revoke.ts`

- [ ] **Step 1: Write all four contract files**

`admin-invite-create.ts`:
```ts
import { z } from 'zod'

export const AdminInviteCreateInput = z.object({
  email: z.string().email(),
})

export const AdminInviteCreateOutput = z.object({
  inviteId: z.string().uuid(),
  expiresAt: z.string(),
})
```

`admin-invite-accept.ts`:
```ts
import { z } from 'zod'

export const AdminInviteAcceptInput = z.object({
  token: z.string().min(20),
})

export const AdminInviteAcceptOutput = z.object({
  ok: z.literal(true),
})
```

`admin-invite-revoke.ts`:
```ts
import { z } from 'zod'

export const AdminInviteRevokeInput = z.object({
  inviteId: z.string().uuid(),
})

export const AdminInviteRevokeOutput = z.object({
  ok: z.literal(true),
})
```

`admin-revoke.ts`:
```ts
import { z } from 'zod'

export const AdminRevokeInput = z.object({
  userId: z.string().uuid(),
})

export const AdminRevokeOutput = z.object({
  ok: z.literal(true),
})
```

- [ ] **Step 2: Type-check**

```bash
cd packages/shared && node ../../node_modules/typescript/bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/contracts/admin-*.ts
git commit -m "feat(shared): zod contracts for admin edge functions"
```

---

### Task 4: AdminPort definition

**Files:**
- Create: `packages/shared/src/ports/admin.ts`
- Modify: `packages/shared/src/ports/index.ts`

- [ ] **Step 1: Write port**

```ts
// packages/shared/src/ports/admin.ts

export type AdminRecord = {
  userId: string
  email: string
  grantedAt: string
  grantedBy: string | null
  notes: string | null
}

export type PendingInvite = {
  id: string
  email: string
  invitedBy: string
  createdAt: string
  expiresAt: string
}

export type AdminAction = {
  id: string
  adminUserId: string
  action: string
  targetType: string | null
  targetId: string | null
  payload: Record<string, unknown>
  createdAt: string
}

export type AdminPort = {
  listAdmins(): Promise<AdminRecord[]>
  listPendingInvites(): Promise<PendingInvite[]>
  listActions(params?: { limit?: number }): Promise<AdminAction[]>
  inviteAdmin(email: string): Promise<{ inviteId: string; expiresAt: string }>
  acceptInvite(token: string): Promise<void>
  revokeInvite(inviteId: string): Promise<void>
  revokeAdmin(userId: string): Promise<void>
  isAdmin(userId: string): Promise<boolean>
}
```

- [ ] **Step 2: Re-export**

Modify `packages/shared/src/ports/index.ts`. Append:

```ts
export type { AdminPort, AdminRecord, PendingInvite, AdminAction } from './admin'
```

- [ ] **Step 3: Type-check**

```bash
cd packages/shared && node ../../node_modules/typescript/bin/tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/ports/
git commit -m "feat(shared): AdminPort interface"
```

---

### Task 5: In-memory admin adapter + tests

**Files:**
- Create: `packages/shared/src/adapters/in-memory/admin.ts`
- Create: `packages/shared/src/adapters/in-memory/admin.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/shared/src/adapters/in-memory/admin.test.ts
import { describe, it, expect } from 'vitest'
import { createInMemoryAdmin } from './admin'

describe('createInMemoryAdmin', () => {
  it('starts empty', async () => {
    const { repo } = createInMemoryAdmin()
    expect(await repo.listAdmins()).toEqual([])
    expect(await repo.listPendingInvites()).toEqual([])
    expect(await repo.listActions()).toEqual([])
  })

  it('inviteAdmin adds a pending invite', async () => {
    const { repo, control } = createInMemoryAdmin()
    control.setCurrentUser('u-admin')
    control.seedAdmin({ userId: 'u-admin', email: 'boss@x.se' })
    const { inviteId, expiresAt } = await repo.inviteAdmin('new@x.se')
    expect(inviteId).toMatch(/.+/)
    expect(expiresAt).toMatch(/\d{4}-\d{2}-\d{2}/)
    const pending = await repo.listPendingInvites()
    expect(pending).toHaveLength(1)
    expect(pending[0].email).toBe('new@x.se')
  })

  it('acceptInvite moves pending → admin and clears pending list', async () => {
    const { repo, control } = createInMemoryAdmin()
    control.setCurrentUser('u-admin')
    control.seedAdmin({ userId: 'u-admin', email: 'boss@x.se' })
    await repo.inviteAdmin('new@x.se')
    const token = control.lastGeneratedToken()
    control.setCurrentUser('u-new')
    control.setCurrentEmail('new@x.se')
    await repo.acceptInvite(token)
    expect(await repo.listPendingInvites()).toHaveLength(0)
    const admins = await repo.listAdmins()
    expect(admins.map((a) => a.userId).sort()).toEqual(['u-admin', 'u-new'])
  })

  it('revokeAdmin refuses to leave zero active admins', async () => {
    const { repo, control } = createInMemoryAdmin()
    control.setCurrentUser('u-only')
    control.seedAdmin({ userId: 'u-only', email: 'a@x.se' })
    await expect(repo.revokeAdmin('u-only')).rejects.toThrow(/last admin/i)
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
cd packages/shared && node ../../node_modules/vitest/vitest.mjs run src/adapters/in-memory/admin.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/adapters/in-memory/admin.ts
import type {
  AdminPort,
  AdminRecord,
  PendingInvite,
  AdminAction,
} from '../../ports/admin'

type Invite = PendingInvite & { tokenHash: string; acceptedAt?: string; revokedAt?: string }
type Admin = AdminRecord & { revokedAt?: string }

export type InMemoryAdminControl = {
  setCurrentUser(id: string): void
  setCurrentEmail(email: string): void
  seedAdmin(admin: { userId: string; email: string }): void
  lastGeneratedToken(): string
  reset(): void
}

export function createInMemoryAdmin(): { repo: AdminPort; control: InMemoryAdminControl } {
  const admins = new Map<string, Admin>()
  const invites = new Map<string, Invite>()
  const actions: AdminAction[] = []
  let currentUser = ''
  let currentEmail = ''
  let lastToken = ''
  let nextId = 1

  function nowIso() {
    return new Date().toISOString()
  }
  function requireAdmin() {
    const a = admins.get(currentUser)
    if (!a || a.revokedAt) throw new Error('not_admin')
  }
  function activeAdminsCount() {
    return Array.from(admins.values()).filter((a) => !a.revokedAt).length
  }
  function log(action: string, targetType: string | null, targetId: string | null, payload = {}) {
    actions.push({
      id: `act-${nextId++}`,
      adminUserId: currentUser,
      action,
      targetType,
      targetId,
      payload,
      createdAt: nowIso(),
    })
  }

  const repo: AdminPort = {
    async listAdmins() {
      return Array.from(admins.values())
        .filter((a) => !a.revokedAt)
        .map(({ revokedAt: _r, ...rest }) => rest)
    },
    async listPendingInvites() {
      return Array.from(invites.values())
        .filter((i) => !i.acceptedAt && !i.revokedAt)
        .map(({ tokenHash: _t, acceptedAt: _a, revokedAt: _r, ...rest }) => rest)
    },
    async listActions(params) {
      const limit = params?.limit ?? 50
      return actions.slice(-limit).reverse()
    },
    async inviteAdmin(email) {
      requireAdmin()
      const token = `tok-${nextId++}-${Math.random().toString(36).slice(2)}`
      lastToken = token
      const id = `inv-${nextId++}`
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      invites.set(id, {
        id,
        email,
        invitedBy: currentUser,
        createdAt: nowIso(),
        expiresAt,
        tokenHash: token, // in-memory: plain token acts as its own hash
      })
      log('admin.invite.sent', 'email', email)
      return { inviteId: id, expiresAt }
    },
    async acceptInvite(token) {
      const invite = Array.from(invites.values()).find((i) => i.tokenHash === token)
      if (!invite) throw new Error('invite_not_found')
      if (invite.acceptedAt) throw new Error('invite_already_accepted')
      if (invite.revokedAt) throw new Error('invite_revoked')
      if (Date.parse(invite.expiresAt) < Date.now()) throw new Error('invite_expired')
      if (invite.email !== currentEmail) throw new Error('invite_email_mismatch')
      admins.set(currentUser, {
        userId: currentUser,
        email: currentEmail,
        grantedAt: nowIso(),
        grantedBy: invite.invitedBy,
        notes: null,
      })
      invite.acceptedAt = nowIso()
      log('admin.invite.accepted', 'admin_user', currentUser)
    },
    async revokeInvite(inviteId) {
      requireAdmin()
      const invite = invites.get(inviteId)
      if (!invite) throw new Error('invite_not_found')
      invite.revokedAt = nowIso()
      log('admin.invite.revoked', 'admin_invite', inviteId)
    },
    async revokeAdmin(userId) {
      requireAdmin()
      if (activeAdminsCount() <= 1) throw new Error('cannot_revoke_last_admin')
      const a = admins.get(userId)
      if (!a) throw new Error('admin_not_found')
      a.revokedAt = nowIso()
      log('admin.revoked', 'admin_user', userId)
    },
    async isAdmin(userId) {
      const a = admins.get(userId)
      return !!a && !a.revokedAt
    },
  }

  const control: InMemoryAdminControl = {
    setCurrentUser: (id) => {
      currentUser = id
    },
    setCurrentEmail: (email) => {
      currentEmail = email
    },
    seedAdmin: ({ userId, email }) => {
      admins.set(userId, {
        userId,
        email,
        grantedAt: nowIso(),
        grantedBy: null,
        notes: null,
      })
    },
    lastGeneratedToken: () => lastToken,
    reset: () => {
      admins.clear()
      invites.clear()
      actions.length = 0
      currentUser = ''
      currentEmail = ''
      lastToken = ''
    },
  }

  return { repo, control }
}
```

- [ ] **Step 4: Run — expect pass**

```bash
node ../../node_modules/vitest/vitest.mjs run src/adapters/in-memory/admin.test.ts
```

Expected: 4/4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/adapters/in-memory/admin.ts packages/shared/src/adapters/in-memory/admin.test.ts
git commit -m "feat(shared): in-memory AdminPort adapter with control handle"
```

---

### Task 6: Wire AdminPort into Deps + factories

**Files:**
- Modify: `packages/shared/src/deps.ts`
- Modify: `packages/shared/src/deps-factory.ts`

- [ ] **Step 1: Extend Deps**

Open `packages/shared/src/deps.ts`. Locate the `Deps` type and add `admin: AdminPort`:

```ts
import type { AdminPort } from './ports/admin'

export type Deps = {
  markets: FleaMarketRepository
  marketTables: MarketTableRepository
  routes: RouteRepository
  profiles: ProfileRepository
  admin: AdminPort
}
```

(Keep the existing imports; just add AdminPort.)

- [ ] **Step 2: Update `makeInMemoryDeps`**

Modify `packages/shared/src/deps-factory.ts`:

```ts
import { createInMemoryAdmin } from './adapters/in-memory/admin'
// ... existing imports ...

export function makeInMemoryDeps(
  seed: StoredMarket[] = [],
  routes: StoredRoute[] = [],
  profiles: UserProfile[] = [],
): Deps {
  return {
    markets: createInMemoryFleaMarkets(seed),
    marketTables: createInMemoryMarketTables(),
    routes: createInMemoryRoutes(routes),
    profiles: createInMemoryProfiles(profiles),
    admin: createInMemoryAdmin().repo,
  }
}
```

- [ ] **Step 3: Update `createE2EInMemoryDeps`** (from e2e-foundation branch)

If the `createE2EInMemoryDeps` function exists in this branch (it will once e2e-foundation merges), add `admin` to the returned deps the same way. If it doesn't exist yet, skip this step — the e2e-foundation merge will create it and a follow-up task can wire admin in.

- [ ] **Step 4: Update `makeSupabaseDeps`** — add `admin` placeholder for now

```ts
import { createSupabaseAdmin } from './adapters/supabase/admin'
// ...

export function makeSupabaseDeps(supabase: SupabaseClient): Deps {
  return {
    markets: createSupabaseFleaMarkets(supabase),
    marketTables: createSupabaseMarketTables(supabase),
    routes: createSupabaseRoutes(supabase),
    profiles: createSupabaseProfiles(supabase),
    admin: createSupabaseAdmin(supabase),
  }
}
```

`createSupabaseAdmin` is implemented in Task 8.

- [ ] **Step 5: Type-check**

```bash
cd packages/shared && node ../../node_modules/typescript/bin/tsc --noEmit
```

Will fail on `createSupabaseAdmin` missing — expected. Will pass after Task 8.

- [ ] **Step 6: Commit (without running tests yet — compiler unblocks after Task 8)**

```bash
git add packages/shared/src/deps.ts packages/shared/src/deps-factory.ts
git commit -m "feat(shared): wire AdminPort into Deps container"
```

---

### Task 7: `_shared/email.ts` — Resend wrapper for edge functions

**Files:**
- Create: `supabase/functions/_shared/email.ts`
- Create: `supabase/functions/_shared/email.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// supabase/functions/_shared/email.test.ts
// Run: deno test supabase/functions/_shared/email.test.ts
import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { sendEmail, type SendEmailOpts } from './email.ts'

Deno.test('sendEmail posts JSON payload to Resend', async () => {
  const calls: RequestInit[] = []
  const fakeFetch = async (_url: string | URL, init?: RequestInit) => {
    calls.push(init!)
    return new Response(JSON.stringify({ id: 're_123' }), { status: 200 })
  }
  const opts: SendEmailOpts = {
    to: 'you@example.com',
    subject: 'Hello',
    html: '<p>Hi</p>',
    text: 'Hi',
    from: 'Fyndstigen <noreply@fyndstigen.se>',
    apiKey: 'rk_test',
    fetchImpl: fakeFetch,
  }
  const { id } = await sendEmail(opts)
  assertEquals(id, 're_123')
  assertEquals(calls.length, 1)
  const body = JSON.parse(calls[0].body as string)
  assertEquals(body.to, 'you@example.com')
  assertEquals(body.subject, 'Hello')
})

Deno.test('sendEmail throws on non-2xx', async () => {
  const fakeFetch = async () => new Response('fail', { status: 500 })
  await assertRejects(
    () =>
      sendEmail({
        to: 'x@y.se',
        subject: 's',
        html: 'h',
        text: 't',
        from: 'x',
        apiKey: 'k',
        fetchImpl: fakeFetch,
      }),
    Error,
    'Resend',
  )
})
```

- [ ] **Step 2: Run — fail**

```bash
deno test supabase/functions/_shared/email.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement**

```ts
// supabase/functions/_shared/email.ts

export type SendEmailOpts = {
  to: string
  subject: string
  html: string
  text: string
  from: string
  apiKey: string
  fetchImpl?: typeof fetch
}

export async function sendEmail(opts: SendEmailOpts): Promise<{ id: string }> {
  const f = opts.fetchImpl ?? fetch
  const res = await f('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend ${res.status}: ${body}`)
  }
  const json = (await res.json()) as { id: string }
  return { id: json.id }
}

/**
 * Default from-header. Requires the `fyndstigen.se` sender domain to be
 * verified in Resend (see SETUP-CHECKLIST).
 */
export const DEFAULT_FROM = 'Fyndstigen <noreply@fyndstigen.se>'
```

- [ ] **Step 4: Run — pass**

```bash
deno test supabase/functions/_shared/email.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/email.ts supabase/functions/_shared/email.test.ts
git commit -m "feat(email): Resend wrapper with injectable fetch for tests"
```

---

### Task 8: Supabase admin adapter

**Files:**
- Create: `packages/shared/src/adapters/supabase/admin.ts`
- Create: `packages/shared/src/adapters/supabase/admin.test.ts`

- [ ] **Step 1: Implement adapter**

```ts
// packages/shared/src/adapters/supabase/admin.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AdminPort,
  AdminRecord,
  PendingInvite,
  AdminAction,
} from '../../ports/admin'

function invokeOrThrow<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  if (res.data == null) throw new Error('empty response')
  return res.data
}

export function createSupabaseAdmin(supabase: SupabaseClient): AdminPort {
  return {
    async listAdmins() {
      const { data, error } = await supabase
        .from('admin_users')
        .select('user_id, granted_at, granted_by, notes, user:auth_user_email_view(email)')
        .is('revoked_at', null)
        .order('granted_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((row: Record<string, unknown>) => ({
        userId: row.user_id as string,
        email: ((row.user as { email?: string } | null)?.email ?? '') as string,
        grantedAt: row.granted_at as string,
        grantedBy: (row.granted_by as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
      })) as AdminRecord[]
    },

    async listPendingInvites() {
      const { data, error } = await supabase
        .from('admin_invites')
        .select('id, email, invited_by, created_at, expires_at')
        .is('accepted_at', null)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        invitedBy: row.invited_by,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      })) as PendingInvite[]
    },

    async listActions(params) {
      const { data, error } = await supabase
        .from('admin_actions')
        .select('id, admin_user_id, action, target_type, target_id, payload, created_at')
        .order('created_at', { ascending: false })
        .limit(params?.limit ?? 50)
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id,
        adminUserId: row.admin_user_id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        payload: row.payload ?? {},
        createdAt: row.created_at,
      })) as AdminAction[]
    },

    async inviteAdmin(email) {
      const res = await supabase.functions.invoke('admin-invite-create', { body: { email } })
      return invokeOrThrow<{ inviteId: string; expiresAt: string }>(res as never)
    },
    async acceptInvite(token) {
      const res = await supabase.functions.invoke('admin-invite-accept', { body: { token } })
      invokeOrThrow<{ ok: true }>(res as never)
    },
    async revokeInvite(inviteId) {
      const res = await supabase.functions.invoke('admin-invite-revoke', { body: { inviteId } })
      invokeOrThrow<{ ok: true }>(res as never)
    },
    async revokeAdmin(userId) {
      const res = await supabase.functions.invoke('admin-revoke', { body: { userId } })
      invokeOrThrow<{ ok: true }>(res as never)
    },
    async isAdmin(userId) {
      const { data, error } = await supabase.rpc('is_admin', { uid: userId })
      if (error) throw error
      return !!data
    },
  }
}
```

Note: `auth_user_email_view` is referenced but doesn't exist yet — it's a SQL view that joins `admin_users.user_id` to `auth.users.email` for display. Add it in the migration.

- [ ] **Step 2: Append view to 00018_admin.sql**

Edit `supabase/migrations/00018_admin.sql`, append at the bottom:

```sql
-- Convenience view for the admin UI to show emails without granting direct
-- access to auth.users (which has RLS off by default).
create or replace view public.auth_user_email_view with (security_invoker = on) as
  select id, email from auth.users;

grant select on public.auth_user_email_view to authenticated;
```

Re-run `supabase db reset` locally.

- [ ] **Step 3: Write a minimal unit test for the adapter**

```ts
// packages/shared/src/adapters/supabase/admin.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createSupabaseAdmin } from './admin'

function fakeClient(resp: unknown) {
  const builder: any = {
    select: () => builder,
    is: () => builder,
    order: () => builder,
    limit: () => builder,
    then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(resp)),
  }
  return {
    from: () => builder,
    rpc: vi.fn(async () => ({ data: true, error: null })),
    functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) },
  } as never
}

describe('createSupabaseAdmin', () => {
  it('isAdmin calls rpc("is_admin") with the user id', async () => {
    const client = fakeClient({ data: [], error: null })
    const admin = createSupabaseAdmin(client)
    expect(await admin.isAdmin('u1')).toBe(true)
    expect((client as any).rpc).toHaveBeenCalledWith('is_admin', { uid: 'u1' })
  })

  it('inviteAdmin calls functions.invoke("admin-invite-create")', async () => {
    const client = {
      from: () => ({}),
      rpc: vi.fn(),
      functions: {
        invoke: vi.fn(async () => ({
          data: { inviteId: 'i1', expiresAt: '2026-05-01T00:00:00Z' },
          error: null,
        })),
      },
    } as never
    const admin = createSupabaseAdmin(client)
    const r = await admin.inviteAdmin('x@y.se')
    expect(r.inviteId).toBe('i1')
    expect((client as any).functions.invoke).toHaveBeenCalledWith('admin-invite-create', {
      body: { email: 'x@y.se' },
    })
  })
})
```

- [ ] **Step 4: Run**

```bash
cd packages/shared && node ../../node_modules/vitest/vitest.mjs run src/adapters/supabase/admin.test.ts
```

Expected: 2/2 pass.

- [ ] **Step 5: Type-check full shared + web**

```bash
cd packages/shared && node ../../node_modules/typescript/bin/tsc --noEmit
cd ../../web && node ../node_modules/typescript/bin/tsc --noEmit
```

Expected: no errors (Task 6 deps-factory gap now closed).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/00018_admin.sql packages/shared/src/adapters/supabase/admin.ts packages/shared/src/adapters/supabase/admin.test.ts
git commit -m "feat(shared): Supabase adapter for AdminPort + email view"
```

---

### Task 9: Edge function — `admin-invite-create`

**Files:**
- Create: `supabase/functions/_shared/email-templates/admin-invite.ts`
- Create: `supabase/functions/admin-invite-create/index.ts`
- Create: `supabase/functions/admin-invite-create/index.test.ts`

- [ ] **Step 1: Write email template**

```ts
// supabase/functions/_shared/email-templates/admin-invite.ts

export function adminInviteEmail(opts: { inviterEmail: string; acceptUrl: string }) {
  const { inviterEmail, acceptUrl } = opts
  const html = `
<!doctype html>
<html>
<body style="font-family: system-ui, sans-serif; color: #2C241D; background: #F2EBE0; padding: 24px;">
  <div style="max-width: 520px; margin: 0 auto; background: #FAF7F2; padding: 32px; border-radius: 12px;">
    <h1 style="font-family: Georgia, serif; color: #A84B2A; margin-top: 0;">Välkommen som Fyndstigen-admin</h1>
    <p>${inviterEmail} har bjudit in dig att bli admin på Fyndstigen.</p>
    <p>Klicka på länken nedan för att aktivera ditt admin-konto. Länken är giltig i 7 dagar.</p>
    <p><a href="${acceptUrl}" style="display:inline-block; background:#A84B2A; color:#fff; padding:12px 20px; border-radius:6px; text-decoration:none;">Aktivera admin-konto</a></p>
    <p style="font-size: 12px; color: #4A3F34;">Om knappen inte fungerar, kopiera denna länk till din webbläsare:<br/>${acceptUrl}</p>
  </div>
</body>
</html>`.trim()
  const text = `Välkommen som Fyndstigen-admin\n\n${inviterEmail} har bjudit in dig.\nÖppna länken för att aktivera:\n${acceptUrl}\n\nLänken gäller i 7 dagar.`
  return { html, text }
}
```

- [ ] **Step 2: Write failing test (happy path + admin guard)**

```ts
// supabase/functions/admin-invite-create/index.test.ts
import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleInviteCreate } from './index.ts'

Deno.test('rejects non-admin caller', async () => {
  const admin = {
    rpc: async () => ({ data: false, error: null }),
  }
  await assertRejects(
    () =>
      handleInviteCreate({
        input: { email: 'x@y.se' },
        userId: 'u1',
        inviterEmail: 'me@x.se',
        origin: 'https://fyndstigen.se',
        admin: admin as never,
        resendApiKey: 'k',
        fetchImpl: async () => new Response('{}', { status: 200 }),
      }),
    Error,
    'not_admin',
  )
})

Deno.test('happy path inserts invite and sends email', async () => {
  let insertedRow: Record<string, unknown> | null = null
  const admin = {
    rpc: async () => ({ data: true, error: null }),
    from: (table: string) => {
      if (table !== 'admin_invites' && table !== 'admin_actions') throw new Error('unexpected ' + table)
      return {
        insert: (row: Record<string, unknown>) => {
          if (table === 'admin_invites') insertedRow = row
          return {
            select: () => ({
              single: async () => ({
                data: { id: 'i1', expires_at: '2026-05-01T00:00:00Z' },
                error: null,
              }),
            }),
          }
        },
      }
    },
  }
  const fetchCalls: string[] = []
  const fakeFetch = async (url: string | URL) => {
    fetchCalls.push(String(url))
    return new Response(JSON.stringify({ id: 're_1' }), { status: 200 })
  }
  const { inviteId } = await handleInviteCreate({
    input: { email: 'x@y.se' },
    userId: 'u1',
    inviterEmail: 'me@x.se',
    origin: 'https://fyndstigen.se',
    admin: admin as never,
    resendApiKey: 'rk',
    fetchImpl: fakeFetch,
  })
  assertEquals(inviteId, 'i1')
  assertEquals(insertedRow?.email, 'x@y.se')
  assertEquals(fetchCalls[0], 'https://api.resend.com/emails')
})
```

- [ ] **Step 3: Run — fail**

```bash
deno test supabase/functions/admin-invite-create/
```

- [ ] **Step 4: Implement**

```ts
// supabase/functions/admin-invite-create/index.ts
import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import { adminInviteEmail } from '../_shared/email-templates/admin-invite.ts'
import {
  AdminInviteCreateInput,
  AdminInviteCreateOutput,
} from '@fyndstigen/shared/contracts/admin-invite-create'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type HandleInviteCreateDeps = {
  input: { email: string }
  userId: string
  inviterEmail: string
  origin: string
  admin: SupabaseClient
  resendApiKey: string
  fetchImpl?: typeof fetch
}

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export async function handleInviteCreate(
  deps: HandleInviteCreateDeps,
): Promise<{ inviteId: string; expiresAt: string }> {
  const { admin, userId, inviterEmail, origin, input, resendApiKey } = deps

  // 1. is_admin check
  const { data: isAdminResult, error: rpcErr } = await admin.rpc('is_admin', { uid: userId })
  if (rpcErr) throw new Error(rpcErr.message)
  if (!isAdminResult) throw new HttpError(403, 'not_admin')

  // 2. Generate token + hash
  const token = generateToken()
  const tokenHash = await hashToken(token)

  // 3. Insert invite
  const { data: invite, error: insErr } = await admin
    .from('admin_invites')
    .insert({
      email: input.email,
      token_hash: tokenHash,
      invited_by: userId,
    })
    .select('id, expires_at')
    .single()
  if (insErr) throw new Error(insErr.message)

  // 4. Send email
  const acceptUrl = `${origin}/admin/invite/accept?token=${encodeURIComponent(token)}`
  const { html, text } = adminInviteEmail({ inviterEmail, acceptUrl })
  await sendEmail({
    to: input.email,
    subject: 'Välkommen som Fyndstigen-admin',
    html,
    text,
    from: DEFAULT_FROM,
    apiKey: resendApiKey,
    fetchImpl: deps.fetchImpl,
  })

  // 5. Log action
  await admin.from('admin_actions').insert({
    admin_user_id: userId,
    action: 'admin.invite.sent',
    target_type: 'email',
    target_id: input.email,
    payload: { inviteId: invite.id },
  })

  return { inviteId: invite.id, expiresAt: invite.expires_at }
}

defineEndpoint({
  name: 'admin-invite-create',
  input: AdminInviteCreateInput,
  output: AdminInviteCreateOutput,
  handler: async ({ user, admin, request }, input) => {
    const origin = request.headers.get('origin') ?? 'https://fyndstigen.se'
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) throw new HttpError(500, 'RESEND_API_KEY missing')
    return handleInviteCreate({
      input,
      userId: user.id,
      inviterEmail: user.email ?? '',
      origin,
      admin,
      resendApiKey,
    })
  },
})
```

Note: `defineEndpoint` in this codebase passes `({ user, admin, request }, input)`. Verify by reading `supabase/functions/_shared/endpoint.ts`; adapt the destructure if the signature differs.

- [ ] **Step 5: Run — pass**

```bash
deno test supabase/functions/admin-invite-create/
```

Expected: 2/2 pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/email-templates/ supabase/functions/admin-invite-create/
git commit -m "feat(edge): admin-invite-create with Resend mail + audit log"
```

---

### Task 10: Edge function — `admin-invite-accept`

**Files:**
- Create: `supabase/functions/admin-invite-accept/index.ts`
- Create: `supabase/functions/admin-invite-accept/index.test.ts`

- [ ] **Step 1: Write failing test** (happy + expired + email-mismatch)

```ts
// supabase/functions/admin-invite-accept/index.test.ts
import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleInviteAccept } from './index.ts'

function fakeAdmin(invite: Record<string, unknown> | null) {
  const calls: { table: string; op: string; row?: unknown }[] = []
  return {
    calls,
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: invite, error: null }),
        }),
      }),
      update: (row: unknown) => {
        calls.push({ table, op: 'update', row })
        return { eq: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }) }
      },
      upsert: (row: unknown) => {
        calls.push({ table, op: 'upsert', row })
        return Promise.resolve({ error: null })
      },
      insert: (row: unknown) => {
        calls.push({ table, op: 'insert', row })
        return Promise.resolve({ error: null })
      },
    }),
  } as never
}

Deno.test('rejects expired invite', async () => {
  const admin = fakeAdmin({
    id: 'i1',
    email: 'x@y.se',
    token_hash: 'hashed',
    expires_at: '2020-01-01T00:00:00Z',
    accepted_at: null,
    revoked_at: null,
  })
  await assertRejects(
    () =>
      handleInviteAccept({
        input: { token: 'anything' },
        userId: 'u1',
        userEmail: 'x@y.se',
        clientIp: '1.1.1.1',
        admin,
      }),
    Error,
    'invite_expired',
  )
})

Deno.test('rejects email mismatch', async () => {
  const admin = fakeAdmin({
    id: 'i1',
    email: 'other@x.se',
    token_hash: 'hashed',
    expires_at: '2099-01-01T00:00:00Z',
    accepted_at: null,
    revoked_at: null,
  })
  await assertRejects(
    () =>
      handleInviteAccept({
        input: { token: 'anything' },
        userId: 'u1',
        userEmail: 'x@y.se',
        clientIp: '1.1.1.1',
        admin,
      }),
    Error,
    'invite_email_mismatch',
  )
})
```

- [ ] **Step 2: Implement**

```ts
// supabase/functions/admin-invite-accept/index.ts
import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  AdminInviteAcceptInput,
  AdminInviteAcceptOutput,
} from '@fyndstigen/shared/contracts/admin-invite-accept'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export type HandleInviteAcceptDeps = {
  input: { token: string }
  userId: string
  userEmail: string
  clientIp: string
  admin: SupabaseClient
}

export async function handleInviteAccept(
  deps: HandleInviteAcceptDeps,
): Promise<{ ok: true }> {
  const { admin, userId, userEmail, clientIp, input } = deps

  const tokenHash = await hashToken(input.token)

  const { data: invite, error: lookupErr } = await admin
    .from('admin_invites')
    .select('id, email, token_hash, expires_at, accepted_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (lookupErr) throw new Error(lookupErr.message)
  if (!invite) throw new HttpError(404, 'invite_not_found')
  if (invite.revoked_at) throw new HttpError(410, 'invite_revoked')
  if (invite.accepted_at) throw new HttpError(409, 'invite_already_accepted')
  if (Date.parse(invite.expires_at) < Date.now()) throw new HttpError(410, 'invite_expired')
  if (!timingSafeEqual(invite.token_hash, tokenHash)) throw new HttpError(403, 'invite_hash_mismatch')
  if (invite.email !== userEmail) throw new HttpError(403, 'invite_email_mismatch')

  // Upsert admin_users (reactivates if previously revoked)
  await admin.from('admin_users').upsert(
    {
      user_id: userId,
      granted_at: new Date().toISOString(),
      granted_by: invite.id,
      revoked_at: null,
    },
    { onConflict: 'user_id' },
  )

  await admin
    .from('admin_invites')
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
      accepted_from_ip: clientIp,
    })
    .eq('id', invite.id)

  await admin.from('admin_actions').insert({
    admin_user_id: userId,
    action: 'admin.invite.accepted',
    target_type: 'admin_user',
    target_id: userId,
    payload: { inviteId: invite.id },
  })

  return { ok: true }
}

defineEndpoint({
  name: 'admin-invite-accept',
  input: AdminInviteAcceptInput,
  output: AdminInviteAcceptOutput,
  handler: async ({ user, admin, request }, input) => {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('cf-connecting-ip') ??
      ''
    return handleInviteAccept({
      input,
      userId: user.id,
      userEmail: user.email ?? '',
      clientIp,
      admin,
    })
  },
})
```

- [ ] **Step 3: Run — pass**

```bash
deno test supabase/functions/admin-invite-accept/
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/admin-invite-accept/
git commit -m "feat(edge): admin-invite-accept with timing-safe hash compare"
```

---

### Task 11: Edge functions — `admin-invite-revoke` and `admin-revoke`

**Files:**
- Create: `supabase/functions/admin-invite-revoke/index.ts`
- Create: `supabase/functions/admin-revoke/index.ts`

- [ ] **Step 1: admin-invite-revoke**

```ts
// supabase/functions/admin-invite-revoke/index.ts
import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  AdminInviteRevokeInput,
  AdminInviteRevokeOutput,
} from '@fyndstigen/shared/contracts/admin-invite-revoke'

defineEndpoint({
  name: 'admin-invite-revoke',
  input: AdminInviteRevokeInput,
  output: AdminInviteRevokeOutput,
  handler: async ({ user, admin }, { inviteId }) => {
    const { data: isAdmin } = await admin.rpc('is_admin', { uid: user.id })
    if (!isAdmin) throw new HttpError(403, 'not_admin')

    const { error } = await admin
      .from('admin_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId)
      .is('accepted_at', null)
    if (error) throw new Error(error.message)

    await admin.from('admin_actions').insert({
      admin_user_id: user.id,
      action: 'admin.invite.revoked',
      target_type: 'admin_invite',
      target_id: inviteId,
    })

    return { ok: true as const }
  },
})
```

- [ ] **Step 2: admin-revoke (with last-admin guard)**

```ts
// supabase/functions/admin-revoke/index.ts
import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  AdminRevokeInput,
  AdminRevokeOutput,
} from '@fyndstigen/shared/contracts/admin-revoke'

defineEndpoint({
  name: 'admin-revoke',
  input: AdminRevokeInput,
  output: AdminRevokeOutput,
  handler: async ({ user, admin }, { userId }) => {
    const { data: isAdmin } = await admin.rpc('is_admin', { uid: user.id })
    if (!isAdmin) throw new HttpError(403, 'not_admin')

    const { count, error: countErr } = await admin
      .from('admin_users')
      .select('user_id', { count: 'exact', head: true })
      .is('revoked_at', null)
    if (countErr) throw new Error(countErr.message)
    if ((count ?? 0) <= 1) throw new HttpError(409, 'cannot_revoke_last_admin')

    const { error } = await admin
      .from('admin_users')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null)
    if (error) throw new Error(error.message)

    await admin.from('admin_actions').insert({
      admin_user_id: user.id,
      action: 'admin.revoked',
      target_type: 'admin_user',
      target_id: userId,
    })

    return { ok: true as const }
  },
})
```

- [ ] **Step 3: Local deploy + smoke-test**

```bash
supabase functions serve --no-verify-jwt &
sleep 5
curl -X POST http://127.0.0.1:54321/functions/v1/admin-invite-revoke \
  -H "Authorization: Bearer $(supabase status --output json | jq -r '.ANON_KEY')" \
  -H "content-type: application/json" \
  -d '{"inviteId": "00000000-0000-0000-0000-000000000000"}'
```

Expected: 403 `not_admin` (anon key is not admin).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/admin-invite-revoke/ supabase/functions/admin-revoke/
git commit -m "feat(edge): admin-invite-revoke + admin-revoke (last-admin guard)"
```

---

### Task 12: Next.js middleware — session gate for `/admin/*`

**Files:**
- Modify: `web/src/middleware.ts`

- [ ] **Step 1: Extend middleware**

```ts
// web/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  if (host.startsWith("www.")) {
    const url = request.nextUrl.clone();
    url.host = host.replace("www.", "");
    url.port = "";
    return NextResponse.redirect(url, 301);
  }

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin")) {
    // /admin/invite/accept is allowed unauthenticated — layout handles
    // redirect back via ?next= after login.
    if (pathname.startsWith("/admin/invite/accept")) return NextResponse.next();

    const hasSession = request.cookies.has("sb-access-token") ||
                       request.cookies.getAll().some(c => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      url.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
}
```

Verify Supabase cookie names match your setup — they vary by SSR helper version. Run `document.cookie` in the browser after signing in to confirm prefixes.

- [ ] **Step 2: Commit**

```bash
git add web/src/middleware.ts
git commit -m "feat(web): middleware session-check for /admin/*"
```

---

### Task 13: React Query hooks for admin

**Files:**
- Create: `web/src/hooks/use-admin.ts`

- [ ] **Step 1: Write hooks**

```ts
// web/src/hooks/use-admin.ts
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeps } from '@/providers/deps-provider'
import { useAuth } from '@/lib/auth-context'

export const adminKeys = {
  all: ['admin'] as const,
  list: () => [...adminKeys.all, 'list'] as const,
  invites: () => [...adminKeys.all, 'invites'] as const,
  actions: () => [...adminKeys.all, 'actions'] as const,
  me: () => [...adminKeys.all, 'me'] as const,
}

export function useIsAdmin() {
  const { admin } = useDeps()
  const { user } = useAuth()
  return useQuery({
    queryKey: adminKeys.me(),
    queryFn: () => (user ? admin.isAdmin(user.id) : Promise.resolve(false)),
    enabled: !!user,
    staleTime: 60_000,
  })
}

export function useAdmins() {
  const { admin } = useDeps()
  return useQuery({ queryKey: adminKeys.list(), queryFn: () => admin.listAdmins() })
}

export function usePendingInvites() {
  const { admin } = useDeps()
  return useQuery({ queryKey: adminKeys.invites(), queryFn: () => admin.listPendingInvites() })
}

export function useAdminActions(limit = 20) {
  const { admin } = useDeps()
  return useQuery({
    queryKey: [...adminKeys.actions(), limit],
    queryFn: () => admin.listActions({ limit }),
  })
}

export function useInviteAdmin() {
  const { admin } = useDeps()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => admin.inviteAdmin(email),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.invites() })
      qc.invalidateQueries({ queryKey: adminKeys.actions() })
    },
  })
}

export function useAcceptInvite() {
  const { admin } = useDeps()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => admin.acceptInvite(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  })
}

export function useRevokeInvite() {
  const { admin } = useDeps()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) => admin.revokeInvite(inviteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.invites() }),
  })
}

export function useRevokeAdmin() {
  const { admin } = useDeps()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => admin.revokeAdmin(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.list() }),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/hooks/use-admin.ts
git commit -m "feat(web): React Query hooks for admin operations"
```

---

### Task 14: `/admin/layout.tsx` — admin-status gate + nav

**Files:**
- Create: `web/src/app/admin/layout.tsx`

- [ ] **Step 1: Write layout**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useIsAdmin } from '@/hooks/use-admin'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'

const navItems = [
  { href: '/admin', label: 'Översikt' },
  { href: '/admin/settings/admins', label: 'Admins' },
  { href: '/admin/import', label: 'Import', disabled: true },
  { href: '/admin/takeover', label: 'Takeover', disabled: true },
  { href: '/admin/social', label: 'Social', disabled: true },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: isAdmin, isLoading } = useIsAdmin()

  // Accept page renders without admin status (handles pre-admin users).
  if (pathname?.startsWith('/admin/invite/accept')) {
    return <>{children}</>
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <FyndstigenLogo size={40} className="text-rust animate-bob" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-bold">Otillåten</h1>
          <p className="mt-2 text-espresso/65">
            Du är inloggad men har inte admin-behörighet. Kontakta en befintlig
            admin om du behöver åtkomst.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh">
      <nav className="border-b border-cream-warm bg-card px-6 py-3 flex items-center gap-6">
        <Link href="/admin" className="font-display font-bold">Fyndstigen Admin</Link>
        <div className="flex items-center gap-4 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.disabled ? '#' : item.href}
              aria-disabled={item.disabled}
              className={`${pathname === item.href ? 'text-rust font-semibold' : 'text-espresso/70'} ${item.disabled ? 'opacity-40 pointer-events-none' : 'hover:text-rust'}`}
            >
              {item.label}
              {item.disabled && ' (snart)'}
            </Link>
          ))}
        </div>
      </nav>
      <div className="max-w-6xl mx-auto p-6">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/app/admin/layout.tsx
git commit -m "feat(web): admin layout with is_admin gate + placeholder nav"
```

---

### Task 15: `/admin` overview page

**Files:**
- Create: `web/src/app/admin/page.tsx`

- [ ] **Step 1: Write page**

```tsx
'use client'

import { useAdmins, useAdminActions } from '@/hooks/use-admin'

export default function AdminOverviewPage() {
  const admins = useAdmins()
  const actions = useAdminActions(20)

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-bold">Översikt</h1>
        <p className="text-espresso/65 mt-1">
          {admins.data?.length ?? '…'} aktiva admins.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold mb-3">Senaste händelser</h2>
        {actions.isLoading && <p className="text-espresso/60">Laddar…</p>}
        {actions.data && actions.data.length === 0 && (
          <p className="text-espresso/60">Inga loggade åtgärder ännu.</p>
        )}
        <ul className="space-y-2">
          {actions.data?.map((a) => (
            <li key={a.id} className="text-sm flex gap-3 border-b border-cream-warm py-2">
              <time className="text-espresso/50 tabular-nums min-w-[150px]">
                {new Date(a.createdAt).toLocaleString('sv-SE')}
              </time>
              <span className="font-mono text-espresso/80">{a.action}</span>
              {a.targetId && <span className="text-espresso/60">→ {a.targetId}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/app/admin/page.tsx
git commit -m "feat(web): /admin overview — admin count + recent actions"
```

---

### Task 16: `/admin/settings/admins` page

**Files:**
- Create: `web/src/app/admin/settings/admins/page.tsx`

- [ ] **Step 1: Write page**

```tsx
'use client'

import { useState } from 'react'
import {
  useAdmins,
  usePendingInvites,
  useInviteAdmin,
  useRevokeInvite,
  useRevokeAdmin,
} from '@/hooks/use-admin'

export default function AdminsSettingsPage() {
  const admins = useAdmins()
  const invites = usePendingInvites()
  const invite = useInviteAdmin()
  const revokeInvite = useRevokeInvite()
  const revokeAdmin = useRevokeAdmin()
  const [email, setEmail] = useState('')

  async function onInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    await invite.mutateAsync(email)
    setEmail('')
  }

  return (
    <div className="space-y-10">
      <section>
        <h1 className="font-display text-3xl font-bold">Admins</h1>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold">Bjud in ny admin</h2>
        <form onSubmit={onInvite} className="flex gap-3">
          <input
            type="email"
            required
            placeholder="namn@domän.se"
            className="flex-1 px-3 py-2 rounded-md border border-cream-warm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={invite.isPending}
            className="bg-rust text-white px-4 py-2 rounded-md font-semibold disabled:opacity-50"
          >
            {invite.isPending ? 'Skickar…' : 'Bjud in'}
          </button>
        </form>
        {invite.isError && (
          <p className="text-error text-sm">Kunde inte skicka: {String(invite.error)}</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Pending invites</h2>
        {invites.data?.length === 0 && <p className="text-espresso/60">Inga pending invites.</p>}
        <ul className="space-y-2">
          {invites.data?.map((i) => (
            <li key={i.id} className="flex items-center justify-between border-b border-cream-warm py-2 text-sm">
              <span>
                <span className="font-medium">{i.email}</span>
                <span className="text-espresso/50 ml-3">
                  utgår {new Date(i.expiresAt).toLocaleDateString('sv-SE')}
                </span>
              </span>
              <button
                onClick={() => revokeInvite.mutate(i.id)}
                className="text-sm text-rust hover:underline"
              >
                Återkalla
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Aktiva admins</h2>
        <ul className="space-y-2">
          {admins.data?.map((a) => (
            <li key={a.userId} className="flex items-center justify-between border-b border-cream-warm py-2 text-sm">
              <span>
                <span className="font-medium">{a.email || a.userId}</span>
                <span className="text-espresso/50 ml-3">
                  sedan {new Date(a.grantedAt).toLocaleDateString('sv-SE')}
                </span>
              </span>
              <button
                onClick={() => {
                  if (confirm(`Återkalla admin-behörighet för ${a.email || a.userId}?`)) {
                    revokeAdmin.mutate(a.userId)
                  }
                }}
                className="text-sm text-rust hover:underline"
              >
                Återkalla
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/app/admin/settings/admins/page.tsx
git commit -m "feat(web): /admin/settings/admins — invite/list/revoke UI"
```

---

### Task 17: `/admin/invite/accept` page

**Files:**
- Create: `web/src/app/admin/invite/accept/page.tsx`

- [ ] **Step 1: Write page**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useAcceptInvite } from '@/hooks/use-admin'

export default function AcceptInvitePage() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const { user, loading } = useAuth()
  const accept = useAcceptInvite()
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')

  useEffect(() => {
    if (!token || loading || !user || state !== 'idle') return
    setState('running')
    accept
      .mutateAsync(token)
      .then(() => {
        setState('done')
        router.replace('/admin')
      })
      .catch(() => setState('error'))
  }, [token, loading, user, state, accept, router])

  if (!token) return <p className="p-8">Ogiltig länk — token saknas.</p>

  if (!loading && !user) {
    const next = encodeURIComponent(`/admin/invite/accept?token=${token}`)
    router.replace(`/auth?next=${next}`)
    return null
  }

  return (
    <div className="max-w-md mx-auto p-8 text-center">
      <h1 className="font-display text-2xl font-bold">Aktiverar admin-konto…</h1>
      {state === 'running' && <p className="mt-4 text-espresso/65">Ett ögonblick.</p>}
      {state === 'error' && (
        <p className="mt-4 text-error">Kunde inte aktivera inviten. Kontakta den som bjöd in dig.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/app/admin/invite/accept/page.tsx
git commit -m "feat(web): /admin/invite/accept — auto-accept invite after login"
```

---

### Task 18: Full local verification

- [ ] **Step 1: Apply migrations + seed yourself**

Replace the placeholder UUID in `00019_admin_seed_bootstrap.sql` with your real `auth.users.id` from local Supabase, then:

```bash
supabase db reset
```

Expected: your user_id lands in `admin_users`.

- [ ] **Step 2: Type-check + run all tests**

```bash
cd packages/shared && node ../../node_modules/vitest/vitest.mjs run
cd ../../web && node ../node_modules/vitest/vitest.mjs run
node ../node_modules/typescript/bin/tsc --noEmit
cd .. && deno test supabase/functions/
```

Expected: all green.

- [ ] **Step 3: Manual smoke-test**

```bash
RESEND_API_KEY=<your-test-key> supabase functions serve --no-verify-jwt &
cd web && npm run dev
```

Navigate to `/admin`. Sign in first if redirected. Expected:
1. `/admin` shows your admin + 0 actions (or the seed bootstrap action).
2. Go to `/admin/settings/admins` → invite a throwaway email you own.
3. Check the throwaway inbox → click link → accept → land on `/admin` as new admin.
4. Revert the throwaway user's admin via the revoke button.
5. Try to revoke yourself → refused with "cannot_revoke_last_admin".

- [ ] **Step 4: Revert placeholder UUID in seed migration before committing anything else**

Leave `00019_admin_seed_bootstrap.sql` with the `00000000…` placeholder in git. Your real UUID stays in a local-only `.gitignore`'d file or as a one-off `psql` command documented in SETUP-CHECKLIST.

---

## Acceptance

- Migrations apply cleanly on a fresh `supabase db reset`.
- Edge functions reject non-admin callers (`403 not_admin`).
- Invite → accept end-to-end works with a real Resend mail.
- `admin_actions` accumulates one row per invite/accept/revoke.
- `/admin/*` redirects unauthenticated users to `/auth`.
- Non-admins authenticated users see the "Otillåten" page.
- Last-admin self-revoke is blocked.
- RFCs 2–4 (import/takeover/social) can layer on without touching this plan's files.
