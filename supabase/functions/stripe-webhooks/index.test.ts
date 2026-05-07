/**
 * Shell tests for the stripe-webhooks edge function.
 *
 * Tests the HTTP-level contract:
 *   - Missing signature → 400
 *   - Bad signature → 400 with "Webhook Error:" prefix
 *   - Valid event with executor throw → 500 "DB error"
 *   - Valid event success → 200 { received: true }
 *
 * Uses a fake StripeVerifier and in-memory repos so no Stripe SDK, Supabase,
 * or network is required.
 *
 * Run with:
 *   deno test --allow-all --import-map=supabase/functions/deno.json \
 *     supabase/functions/stripe-webhooks/index.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleWebhook, type WebhookDeps } from './index.ts'
import type { WebhookRepos } from './execute.ts'
import type { Logger } from '@fyndstigen/shared/ports/logger.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_EVENT = {
  id: 'evt_test',
  object: 'event',
  type: 'invoice.payment_failed',
  api_version: '2024-04-10',
  created: 0,
  livemode: false,
  pending_webhooks: 0,
  request: null,
  data: {
    object: {
      id: 'in_1',
      customer: 'cus_1',
    },
  },
}

function makeNullLogger(): Logger {
  return {
    warn() {},
    info() {},
    error() {},
  }
}

function makeRepos(opts: { throwOnCall?: boolean } = {}): WebhookRepos {
  return {
    bookings: {
      async findById() { return null },
      async findByPaymentIntent() { return null },
      async applyEvent() {
        if (opts.throwOnCall) throw new Error('DB error')
        return {} as never
      },
    },
    stripeAccounts: {
      async setOnboardingComplete() {
        if (opts.throwOnCall) throw new Error('DB error')
      },
    },
    subscriptions: {
      async setTierByUserId() {
        if (opts.throwOnCall) throw new Error('DB error')
      },
      async setTierByCustomerId() {
        if (opts.throwOnCall) throw new Error('DB error')
      },
    },
    logger: makeNullLogger(),
  }
}

function makeVerifier(opts: { throw?: boolean; event?: unknown } = {}) {
  return {
    async constructEventAsync(_body: string, _sig: string, _secret: string) {
      if (opts.throw) throw new Error('No signatures found matching the expected signature for payload')
      return (opts.event ?? FAKE_EVENT) as never
    },
  }
}

function makeRequest(opts: { sig?: string | null; body?: string } = {}) {
  const headers = new Headers()
  if (opts.sig !== null) {
    headers.set('stripe-signature', opts.sig ?? 'sig_valid')
  }
  return new Request('https://example.com/stripe-webhooks', {
    method: 'POST',
    headers,
    body: opts.body ?? JSON.stringify(FAKE_EVENT),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('stripe-webhooks shell: missing signature → 400', async () => {
  const deps: WebhookDeps = {
    verifier: makeVerifier(),
    repos: makeRepos(),
    webhookSecret: 'whsec_test',
  }
  const req = makeRequest({ sig: null })
  const res = await handleWebhook(req, deps)
  assertEquals(res.status, 400)
  const text = await res.text()
  assertEquals(text, 'Missing signature')
})

Deno.test('stripe-webhooks shell: bad signature → 400 with Webhook Error prefix', async () => {
  const deps: WebhookDeps = {
    verifier: makeVerifier({ throw: true }),
    repos: makeRepos(),
    webhookSecret: 'whsec_test',
  }
  const req = makeRequest({ sig: 'bad_sig' })
  const res = await handleWebhook(req, deps)
  assertEquals(res.status, 400)
  const text = await res.text()
  assertEquals(text.startsWith('Webhook Error:'), true)
})

Deno.test('stripe-webhooks shell: verified event with executor throw → 500 DB error', async () => {
  const deps: WebhookDeps = {
    verifier: makeVerifier(),
    repos: makeRepos({ throwOnCall: true }),
    webhookSecret: 'whsec_test',
    // Use a payment_intent event so executor will call a booking repo method
    // Actually, for invoice.payment_failed the executor calls logger.warn — won't throw
    // Use account.updated which calls stripeAccounts.setOnboardingComplete
  }
  // Override event to one that will hit the repo throw
  const accountEvent = {
    ...FAKE_EVENT,
    type: 'account.updated',
    data: {
      object: {
        id: 'acct_1',
        charges_enabled: true,
        details_submitted: true,
        payouts_enabled: true,
      },
    },
  }
  const deps2: WebhookDeps = {
    verifier: makeVerifier({ event: accountEvent }),
    repos: makeRepos({ throwOnCall: true }),
    webhookSecret: 'whsec_test',
  }
  const req = makeRequest({ body: JSON.stringify(accountEvent) })
  const res = await handleWebhook(req, deps2)
  assertEquals(res.status, 500)
  const text = await res.text()
  assertEquals(text, 'DB error')
})

Deno.test('stripe-webhooks shell: verified event success → 200 { received: true }', async () => {
  const deps: WebhookDeps = {
    verifier: makeVerifier(),
    repos: makeRepos(),
    webhookSecret: 'whsec_test',
  }
  const req = makeRequest()
  const res = await handleWebhook(req, deps)
  assertEquals(res.status, 200)
  const json = await res.json()
  assertEquals(json, { received: true })
})
