# Sentry + PostHog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Sentry error tracking to both web (Next.js/Cloudflare) and app (React Native), then add PostHog analytics to both platforms.

**Architecture:** Sentry is initialized via Next.js instrumentation hooks — `instrumentation-client.ts` (browser), `sentry.server.config.ts` (Node.js), `sentry.edge.config.ts` (Edge/Cloudflare), loaded through `instrumentation.ts`. For React Native, Sentry inits in `App.tsx` before any other providers. PostHog follows the same pattern: a provider wrapper for web and early init for app. Both services use environment variables for DSNs/keys so nothing is hardcoded.

**Tech Stack:** `@sentry/nextjs` (web), `@sentry/react-native` (app), `posthog-js` (web), `posthog-react-native` (app)

---

## File Structure

### Sentry — Web (`web/`) — follows [official Sentry Next.js SDK skill](https://github.com/getsentry/sentry-for-ai/blob/main/skills/sentry-nextjs-sdk/SKILL.md)
- Create: `web/instrumentation-client.ts` — browser/client runtime init (replaces old `sentry.client.config.ts` pattern)
- Create: `web/sentry.server.config.ts` — Node.js server runtime init
- Create: `web/sentry.edge.config.ts` — Edge runtime init (Cloudflare Workers)
- Create: `web/instrumentation.ts` — server-side registration hook with `onRequestError`
- Create: `web/src/app/global-error.tsx` — root error boundary with Sentry reporting
- Create: `web/.env.sentry-build-plugin` — source map upload auth token (gitignored)
- Modify: `web/next.config.ts` — wrap with `withSentryConfig` (tunnelRoute, widenClientFileUpload)
- Modify: `web/package.json` — add `@sentry/nextjs` dependency
- Modify: `web/.env.example` — add `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`
- Modify: `web/.gitignore` — add `.env.sentry-build-plugin`
- Modify: `web/src/hooks/use-query.ts` — capture exceptions to Sentry

### Sentry — App (`app/`)
- Create: `app/src/lib/sentry.ts` — Sentry init and helpers
- Modify: `app/src/App.tsx` — wrap with `Sentry.wrap()`
- Modify: `app/package.json` — add `@sentry/react-native`
- Modify: `app/.config/.development.env.example` — add `SENTRY_DSN`
- Modify: `app/src/app/AppLoader.tsx` — capture init errors to Sentry
- Modify: `app/src/hooks/use-query.ts` or equivalent thunk error handlers — capture to Sentry

### PostHog — Web (`web/`)
- Create: `web/src/lib/posthog.ts` — PostHog provider component
- Modify: `web/src/app/layout.tsx` — add PostHogProvider
- Modify: `web/package.json` — add `posthog-js`
- Modify: `web/.env.example` — add `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`

### PostHog — App (`app/`)
- Create: `app/src/lib/posthog.ts` — PostHog init
- Modify: `app/src/App.tsx` — add PostHogProvider
- Modify: `app/package.json` — add `posthog-react-native`
- Modify: `app/.config/.development.env.example` — add `POSTHOG_KEY`, `POSTHOG_HOST`

---

## Task 1: Sentry — Web SDK install and config files

**Files:**
- Modify: `web/package.json`
- Create: `web/instrumentation-client.ts`
- Create: `web/sentry.server.config.ts`
- Create: `web/sentry.edge.config.ts`
- Create: `web/instrumentation.ts`
- Modify: `web/.env.example`
- Modify: `web/.gitignore`

- [ ] **Step 1: Install `@sentry/nextjs`**

```bash
cd web && npm install @sentry/nextjs
```

- [ ] **Step 2: Add env vars to `.env.example` and `.gitignore`**

Add to `web/.env.example`:
```
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@o0.ingest.sentry.io/0
SENTRY_DSN=https://your-dsn@o0.ingest.sentry.io/0
```

Add to `web/.gitignore`:
```
.env.sentry-build-plugin
```

Also add the real DSNs to `web/.env.local` (not committed).

- [ ] **Step 3: Create `web/instrumentation-client.ts` — Browser/Client Runtime**

```typescript
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  sendDefaultPii: true,

  // 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Session Replay: 10% of all sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  enableLogs: true,

  integrations: [
    Sentry.replayIntegration(),
  ],
})

// Hook into App Router navigation transitions
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
```

- [ ] **Step 4: Create `web/sentry.server.config.ts` — Node.js Server Runtime**

```typescript
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Attach local variable values to stack frames
  includeLocalVariables: true,

  enableLogs: true,
})
```

- [ ] **Step 5: Create `web/sentry.edge.config.ts` — Edge Runtime**

```typescript
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  enableLogs: true,
})
```

- [ ] **Step 6: Create `web/instrumentation.ts` — Server-Side Registration Hook**

```typescript
import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

// Automatically captures all unhandled server-side request errors
export const onRequestError = Sentry.captureRequestError
```

- [ ] **Step 7: Commit**

```bash
git add web/package.json web/package-lock.json web/instrumentation-client.ts web/sentry.server.config.ts web/sentry.edge.config.ts web/instrumentation.ts web/.env.example web/.gitignore
git commit -m "feat(web): add Sentry SDK with client, server, and edge config"
```

---

## Task 2: Sentry — Web Next.js config and error boundary

**Files:**
- Modify: `web/next.config.ts`
- Create: `web/src/app/global-error.tsx`

- [ ] **Step 1: Wrap next.config with `withSentryConfig`**

Update `web/next.config.ts`:

```typescript
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ['@fyndstigen/shared'],
  allowedDevOrigins: ['192.168.50.245'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*',
      },
    ]
  },
};

initOpenNextCloudflareForDev();

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Source map upload — set SENTRY_AUTH_TOKEN in .env.sentry-build-plugin or CI
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload wider set of client source files for better stack traces
  widenClientFileUpload: true,

  // Proxy route to bypass ad-blockers
  tunnelRoute: "/monitoring",

  // Suppress non-CI output
  silent: !process.env.CI,
});
```

Note: Source map upload requires `SENTRY_AUTH_TOKEN`. Create a token at sentry.io/settings/auth-tokens/ with `project:releases` and `org:read` scopes. Store it in `web/.env.sentry-build-plugin` (already gitignored) or as a CI secret.

- [ ] **Step 2: Create `web/src/app/global-error.tsx` — App Router Error Boundary**

```tsx
"use client"

import * as Sentry from "@sentry/nextjs"
import NextError from "next/error"
import { useEffect } from "react"

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="sv">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Verify build works**

```bash
cd web && npm run build
```

Expected: Build succeeds without errors.

- [ ] **Step 4: Commit**

```bash
git add web/next.config.ts web/src/app/global-error.tsx
git commit -m "feat(web): integrate Sentry with Next.js config and global error boundary"
```

---

## Task 3: Sentry — Web hook into existing error patterns

**Files:**
- Modify: `web/src/hooks/use-query.ts`

- [ ] **Step 1: Add Sentry capture to `useQuery` and `useMutation`**

Update `web/src/hooks/use-query.ts` — add import and capture in catch blocks:

Add at top of file:
```typescript
import * as Sentry from '@sentry/nextjs'
```

In `useQuery`, change the `.catch()` block (around line 40-42):
```typescript
      .catch((err) => {
        if (seq === seqRef.current) setError(errorMessage)
        Sentry.captureException(err)
      })
```

In `useMutation`, change the `catch` block (around line 83-85):
```typescript
    } catch (err) {
      setError(errorMessage)
      Sentry.captureException(err)
      return undefined
    }
```

- [ ] **Step 2: Verify build**

```bash
cd web && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add web/src/hooks/use-query.ts
git commit -m "feat(web): capture query/mutation errors in Sentry"
```

---

## Task 4: Sentry — React Native SDK install and config

**Files:**
- Modify: `app/package.json`
- Create: `app/src/lib/sentry.ts`
- Modify: `app/.config/.development.env.example`

- [ ] **Step 1: Install `@sentry/react-native`**

```bash
cd app && npm install @sentry/react-native
```

- [ ] **Step 2: Add env var to example config**

Add to `app/.config/.development.env.example`:
```
SENTRY_DSN=https://your-dsn@o0.ingest.sentry.io/0
```

Also add the real DSN to each `.config/.development.env`, `.alpha.env`, `.production.env`.

- [ ] **Step 3: Create Sentry init — `app/src/lib/sentry.ts`**

```typescript
import * as Sentry from '@sentry/react-native'
import { SENTRY_DSN } from '@env'

export function initSentry() {
  if (!SENTRY_DSN) return

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 1.0,
    debug: __DEV__,
    enabled: !__DEV__,
  })
}

export { Sentry }
```

- [ ] **Step 4: Add `SENTRY_DSN` to env type declarations**

In `app/src/types.d.ts`, find the `@env` module declaration and add:
```typescript
export const SENTRY_DSN: string
```

If no `@env` declaration exists, create one:
```typescript
declare module '@env' {
  export const SUPABASE_URL: string
  export const SUPABASE_ANON_KEY: string
  export const GAPI_KEY: string
  export const SENTRY_DSN: string
}
```

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/package-lock.json app/src/lib/sentry.ts app/.config/.development.env.example app/src/types.d.ts
git commit -m "feat(app): add Sentry React Native SDK and configuration"
```

---

## Task 5: Sentry — React Native integration

**Files:**
- Modify: `app/src/App.tsx`
- Modify: `app/src/app/AppLoader.tsx`

- [ ] **Step 1: Wrap App with Sentry and init early**

Update `app/src/App.tsx`:

```typescript
import 'react-native-gesture-handler'
import React from 'react'
import { Provider } from 'react-redux'
import { LogBox } from 'react-native'

import ThemeProvider from './features/theme/ThemeProvider'
import { LocaleProvider } from './features/locale/LocaleContext'
import Router from './features/navigation/Router'

import store from './app/store'
import AppLoader from './app/AppLoader'
import { initSentry, Sentry } from './lib/sentry'

initSentry()

function App() {
  LogBox.ignoreAllLogs()

  return (
    <LocaleProvider>
      <Provider store={store}>
        <ThemeProvider>
          <AppLoader>
            <Router />
          </AppLoader>
        </ThemeProvider>
      </Provider>
    </LocaleProvider>
  )
}

export default Sentry.wrap(App)
```

- [ ] **Step 2: Capture init errors in AppLoader**

Update `app/src/app/AppLoader.tsx` — add Sentry import and capture in the session check:

Add import at top:
```typescript
import { Sentry } from '../lib/sentry'
```

In the `getSession()` call, add error handling (replace the `.then()` with try/catch or add `.catch()`):

After `supabase.auth.getSession().then(...)`, add:
```typescript
    .catch((err) => {
      Sentry.captureException(err)
      setLoading(false)
    })
```

- [ ] **Step 3: Run iOS build to verify**

```bash
cd app && npx react-native run-ios
```

Expected: App boots without crash. Check Metro logs for Sentry init message in debug mode.

- [ ] **Step 4: Commit**

```bash
git add app/src/App.tsx app/src/app/AppLoader.tsx
git commit -m "feat(app): integrate Sentry into app lifecycle and error boundaries"
```

---

## Task 6: PostHog — Web install and provider

**Files:**
- Modify: `web/package.json`
- Create: `web/src/lib/posthog.ts`
- Modify: `web/src/app/layout.tsx`
- Modify: `web/.env.example`

- [ ] **Step 1: Install `posthog-js`**

```bash
cd web && npm install posthog-js
```

- [ ] **Step 2: Add env vars to `.env.example`**

Add to `web/.env.example`:
```
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

Use `eu.i.posthog.com` for EU data residency (relevant for Swedish/GDPR context). Add real values to `.env.local`.

- [ ] **Step 3: Create PostHog provider — `web/src/lib/posthog.ts`**

```typescript
'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
    if (!key || !host) return

    posthog.init(key, {
      api_host: host,
      person_profiles: 'identified_only',
      capture_pageview: false, // we handle this manually below
      capture_pageleave: true,
    })
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}

export function PostHogPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ph = usePostHog()

  useEffect(() => {
    if (pathname && ph) {
      let url = window.origin + pathname
      if (searchParams.toString()) {
        url = url + '?' + searchParams.toString()
      }
      ph.capture('$pageview', { $current_url: url })
    }
  }, [pathname, searchParams, ph])

  return null
}
```

- [ ] **Step 4: Add PostHogProvider to layout**

Update `web/src/app/layout.tsx` — add imports and wrap children:

Add imports:
```typescript
import { PostHogProvider, PostHogPageview } from '@/lib/posthog'
import { Suspense } from 'react'
```

Wrap the body contents with PostHogProvider, and add PostHogPageview inside a Suspense boundary (needed because `useSearchParams` requires it):

```tsx
<body className="min-h-full flex flex-col font-body">
  <PostHogProvider>
    <AuthProvider>
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      <TrailBackground />
      <Nav />
      <main className="flex-1 relative" style={{ zIndex: 1 }}>{children}</main>
      <footer className="border-t border-cream-warm mt-auto relative" style={{ zIndex: 1 }}>
        {/* ... existing footer content unchanged ... */}
      </footer>
    </AuthProvider>
  </PostHogProvider>
</body>
```

- [ ] **Step 5: Verify build**

```bash
cd web && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/package-lock.json web/src/lib/posthog.ts web/src/app/layout.tsx web/.env.example
git commit -m "feat(web): add PostHog analytics with pageview tracking"
```

---

## Task 7: PostHog — React Native install and provider

**Files:**
- Modify: `app/package.json`
- Create: `app/src/lib/posthog.ts`
- Modify: `app/src/App.tsx`
- Modify: `app/.config/.development.env.example`

- [ ] **Step 1: Install `posthog-react-native`**

```bash
cd app && npm install posthog-react-native
```

- [ ] **Step 2: Add env vars to example config**

Add to `app/.config/.development.env.example`:
```
POSTHOG_KEY=phc_your_key_here
POSTHOG_HOST=https://eu.i.posthog.com
```

Add real values to each env file.

- [ ] **Step 3: Create PostHog init — `app/src/lib/posthog.ts`**

```typescript
import PostHog from 'posthog-react-native'
import { POSTHOG_KEY, POSTHOG_HOST } from '@env'

export let posthog: PostHog | null = null

export async function initPostHog() {
  if (!POSTHOG_KEY || !POSTHOG_HOST) return

  posthog = await PostHog.initAsync(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    enableSessionReplay: false,
  })
}
```

- [ ] **Step 4: Add PostHog env vars to type declarations**

In `app/src/types.d.ts`, add to the `@env` module:
```typescript
export const POSTHOG_KEY: string
export const POSTHOG_HOST: string
```

- [ ] **Step 5: Add PostHogProvider to App**

Update `app/src/App.tsx` — add import and provider:

Add imports:
```typescript
import { PostHogProvider } from 'posthog-react-native'
import { initPostHog, posthog } from './lib/posthog'
```

Call `initPostHog()` alongside `initSentry()`:
```typescript
initSentry()
initPostHog()
```

Wrap with PostHogProvider (outermost, before LocaleProvider):
```typescript
function App() {
  LogBox.ignoreAllLogs()

  return (
    <PostHogProvider client={posthog}>
      <LocaleProvider>
        <Provider store={store}>
          <ThemeProvider>
            <AppLoader>
              <Router />
            </AppLoader>
          </ThemeProvider>
        </Provider>
      </LocaleProvider>
    </PostHogProvider>
  )
}
```

- [ ] **Step 6: Verify iOS build**

```bash
cd app && npx react-native run-ios
```

- [ ] **Step 7: Commit**

```bash
git add app/package.json app/package-lock.json app/src/lib/posthog.ts app/src/App.tsx app/.config/.development.env.example app/src/types.d.ts
git commit -m "feat(app): add PostHog analytics for React Native"
```

---

## Task 8: Verify end-to-end

- [ ] **Step 1: Web — run dev server and trigger a test error**

```bash
cd web && npm run dev
```

Open browser, check browser console for Sentry init. Check PostHog network requests going to `eu.i.posthog.com`.

- [ ] **Step 2: App — run on simulator and verify**

```bash
cd app && npm run dev:ios
```

Check Metro output for Sentry debug logs. Verify no crashes on startup.

- [ ] **Step 3: Verify Sentry dashboard receives events**

Go to your Sentry project dashboard and confirm the test error appears.

- [ ] **Step 4: Verify PostHog dashboard receives pageviews**

Go to your PostHog project dashboard and confirm pageview events appear.

- [ ] **Step 5: Final commit (if any fixups needed)**

```bash
git add -A && git commit -m "fix: adjust Sentry/PostHog config after integration testing"
```

---

## Notes

### Sentry Web Setup (follows official skill)
- Uses the modern `instrumentation-client.ts` pattern (not the old `sentry.client.config.ts`)
- `instrumentation.ts` with `onRequestError` automatically captures all unhandled server errors (requires `@sentry/nextjs` >= 8.28.0)
- `tunnelRoute: "/monitoring"` creates a proxy route that bypasses ad-blockers
- `onRouterTransitionStart` export in client config hooks into App Router navigation for tracing
- Source maps: set `SENTRY_AUTH_TOKEN` in `.env.sentry-build-plugin` (gitignored) or CI secrets. Token needs `project:releases` + `org:read` scopes from sentry.io/settings/auth-tokens/

### Sentry on Cloudflare
- The edge config (`sentry.edge.config.ts`) runs in Cloudflare Workers. Keep it minimal — no replay, no browser-specific integrations.
- Source map upload happens during `next build` — works in CI; may need `SENTRY_AUTH_TOKEN` set as a Cloudflare Pages env secret if deploying from there.

### Sentry Environment Variables
| Variable | Runtime | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | Client | DSN for browser Sentry init (public) |
| `SENTRY_DSN` | Server / Edge | DSN for server/edge Sentry init |
| `SENTRY_AUTH_TOKEN` | Build | Source map upload auth token (secret) |
| `SENTRY_ORG` | Build | Org slug |
| `SENTRY_PROJECT` | Build | Project slug |

### PostHog EU Hosting
- Using `eu.i.posthog.com` keeps data in EU, which is important for GDPR. If you self-host PostHog later, just change the host env var.

### Sample Rates
- Sentry `tracesSampleRate`: 1.0 in dev, 0.1 in production (auto-switched via `NODE_ENV`)
- Sentry Replay: 10% of sessions, 100% of sessions with errors
- PostHog `person_profiles: 'identified_only'` means anonymous users don't create person profiles (saves quota)

### Required Accounts
Before starting, you'll need:
1. A **Sentry** account + project (one for web, one for app — or one project with platform tags)
2. A **PostHog** account (EU cloud recommended) + project
3. The DSN/keys added to the respective env files
