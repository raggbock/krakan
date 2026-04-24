# RFC: Admin-auth (foundation för /admin)

**Datum:** 2026-04-24
**Status:** Draft — klar för review.

## 1. Mål och scope

Bygg grunden för `/admin`-ytan så att framtida admin-features (import, takeover, social kit) kan plugga in. Levererar:

- `admin_users`-tabell + `admin_actions`-tabell + `admin_invites`-tabell
- Första admin seedas via migration med manuellt ifylld UUID
- Invite-flöde för nya admins (Resend-mail + engångstoken)
- Route-guarding (middleware + layout + RLS)
- Minimal `/admin`-landningssida som listar aktiva admins och visar audit-loggen
- `/admin/settings/admins` för invite/revoke
- `/admin/invite/accept` för mottagaren att acceptera

**Icke-mål:** själva import/takeover/social kit-features. Bara plumbningen så de kan byggas ovanpå i RFC 2–4.

## 2. Datamodell

Ny migration `supabase/migrations/00018_admin.sql`:

```sql
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  revoked_at timestamptz,
  notes text
);

create index admin_users_active_idx on public.admin_users (user_id) where revoked_at is null;

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
-- No insert/update/delete policies — all writes go through edge functions.
```

Separat seed-migration `00019_admin_seed_bootstrap.sql` (innehåller placeholder-UUID som måste ersättas innan körning; se SETUP-CHECKLIST).

## 3. Invite-flödet

### Admin bjuder in
UI i `/admin/settings/admins` → form med e-post. Edge function `admin-invite-create`:

1. Verifierar `is_admin(auth.uid())`.
2. Genererar 32-byte slumptoken → base64url (~43 tecken).
3. Beräknar `token_hash = sha256(plaintext)`.
4. Insertar rad i `admin_invites`.
5. Skickar Resend-mail med länk: `https://fyndstigen.se/admin/invite/accept?token=<plaintext>`.
6. Loggar `admin_actions` (`action='admin.invite.sent'`, `target_type='email'`, `target_id=<email>`).

Klartexttoken syns bara i mailet. Aldrig i DB. Aldrig i UI-response.

### Mottagaren klickar
`/admin/invite/accept?token=...`:
- Ej inloggad → redirect till `/auth?next=<samma URL>`.
- Inloggad → klient-komponent anropar `admin-invite-accept` med `{ token }`.

### Edge function `admin-invite-accept`
1. Hashar input, slår upp `admin_invites` by `token_hash`.
2. Validerar: inte expired, inte accepted, inte revoked.
3. Konstanttidjämförelse på hash.
4. Kollar att `auth.users.email = admin_invites.email`.
5. Upsertar i `admin_users` (om raden finns men revokerad → reaktiverar genom att nolla `revoked_at`).
6. Sätter `accepted_at = now()`, `accepted_by = auth.uid()`, `accepted_from_ip` från request-header.
7. Loggar `admin_actions` (`action='admin.invite.accepted'`).
8. Klienten redirectar till `/admin`.

### Säkerhet
- Rate-limit: max 10 accept-försök per IP/timme, max 5 per token_hash innan invaliderad.
- TTL: 7 dagar default.
- Email binding: endast inloggad user vars email matchar inviten får acceptera.
- Revoke: admin kan klicka "återkalla" på pending invite → `revoked_at = now()`.
- Självrevoke-skydd: `admin-revoke` vägrar om antalet aktiva admins skulle bli 0.

## 4. Route-guarding och UI-struktur

### Middleware (`web/src/middleware.ts`)
- `/admin/*` utan session → redirect till `/auth?next=<url>`.
- `/admin/invite/accept?token=...` är undantag (får nå sidan även utan session; layout redirectar via `?next=`).
- Middleware gör bara sessionscheck (billig JWT-parse). Admin-status kollas i layout för tydligare feedback.

### `web/src/app/admin/layout.tsx`
- Hämtar `is_admin(auth.uid())` via `AdminPort` i Deps.
- Icke-admin → renderar "Otillåten"-sida (ej redirect).
- Admin → renderar admin-chrome med top-nav: `/admin`, `/admin/settings/admins`, + placeholders för kommande `/admin/import`, `/admin/takeover`, `/admin/social`.

### Sidor i denna RFC
- `/admin` — översikt: antal aktiva admins, senaste 20 `admin_actions`, placeholder-kort för kommande features.
- `/admin/settings/admins` — tabell över aktiva admins (email, granted_at, granted_by), "Bjud in ny"-form, lista över pending invites med revoke-knapp.
- `/admin/invite/accept` — accept-sida.
- Övriga admin-paths lämnas som "Kommer snart"-placeholders.

### RLS-lager
- `admin_users`, `admin_invites`, `admin_actions` har `select`-policy via `is_admin()`.
- Mutations går via edge functions som själva verifierar `is_admin()` + loggar action.

## 5. Edge functions och paketering

Fyra nya edge functions under `supabase/functions/`:

- **`admin-invite-create`** — POST `{ email }`. Caller-admin-check, token-gen, `admin_invites`-insert, Resend-mail, action-log. Returnerar `{ inviteId, expiresAt }`.
- **`admin-invite-accept`** — POST `{ token }`. Hash-lookup, validering, `admin_users`-upsert, invite-markup, action-log. Returnerar `{ ok: true }`.
- **`admin-invite-revoke`** — POST `{ inviteId }`. Sätter `revoked_at`, loggar.
- **`admin-revoke`** — POST `{ userId }`. Sätter `admin_users.revoked_at`. Vägrar om resultat < 1 aktiv admin.

Alla använder befintlig `_shared/handler.ts` för auth/CORS/errors.

### Resend-integration
- Ny `_shared/email.ts` wrappar Resend-klienten. Konfig via `RESEND_API_KEY` env var.
- Mailmall i `_shared/email-templates/admin-invite.ts` — enkel HTML + plain text, använder designtokens från `fyndstigen-social-kit.html` (parchment/espresso).
- Avsändare: `Fyndstigen <noreply@fyndstigen.se>` (DNS/SPF-setup dokumenteras i SETUP-CHECKLIST).

### Klient-hooks
- Ny port `AdminPort` i `@fyndstigen/shared` med metoder:
  - `listAdmins()`, `listPendingInvites()`, `listActions({ limit })`
  - `inviteAdmin(email)`, `revokeInvite(inviteId)`, `acceptInvite(token)`, `revokeAdmin(userId)`
- Supabase-adapter pekar varje metod mot tabell-query eller edge function.
- In-memory-adapter för tester, kompatibel med `createE2EInMemoryDeps`-mönstret.
- Exponeras i `Deps` som `deps.admin`.

## 6. Testning

- **Edge functions**: Deno-tester per funktion. Fokus på:
  - Token-hashning deterministisk, olika input → olika hash.
  - Konstanttidjämförelse vid accept.
  - `is_admin()`-guard avvisar icke-admin.
  - Expired/accepted/revoked → specifika felkoder.
  - Rate-limit via mockad klocka.
- **Shared**: vitest för `AdminPort`-in-memory-adaptern.
- **Web**: vitest för `useAdminList`/`useInviteAdmin`/..., React Testing Library för `/admin/settings/admins`.
- **E2E** (senare, efter onboarding-profilen): Playwright-scenario "seed admin → login → invite → accept → revoke".

### Manuell verifiering i staging (SETUP-CHECKLIST)
1. Kör seed-migration med din user_id → `is_admin(din-uid) = true`.
2. `/admin` laddar utan redirect.
3. Invite till egen testmail → klicka länk → accepterad.
4. Revoke testadmin → dennes `/admin` blockerar.

## 7. Risker och öppna frågor

### Risker
1. **RLS-förbiläckage** — om vi råkar skriva vanlig klient-query mot `admin_users` utan policy-medvetenhet kan datan exponeras. Mitigering: edge functions äger alla mutations, klient-läsningar går bara genom admin-specifika hooks.
2. **Seed-migration med hårdkodad UUID** — riskerar att committas i fel kontext. Mitigering: seed i en separat migration med placeholder + kommentar i SETUP-CHECKLIST, alternativt köra utanför migration-kedjan.
3. **Resend DNS/SPF-setup** — annars spam. Dokumenteras i SETUP-CHECKLIST.
4. **Sista admin revokar sig själv** — utlåsning. Mitigering: edge function räknar aktiva admins och vägrar om resultat < 1.

### Beslutade öppna frågor
- `admin_actions` **inte** exponerat publikt — internt verktyg bara.
- 2FA för admins **out of scope** för denna RFC. Supabase MFA kan aktiveras senare utan schemaändring.
- `admin_invites.accepted_from_ip` **inkluderas** för acceptance-audit.
