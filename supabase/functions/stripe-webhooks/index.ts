/**
 * stripe-webhooks edge function — thin shell (~50 LOC).
 *
 * 1. Verifies the Stripe signature.
 * 2. Pre-fetches any DB lookups needed by the reducer.
 * 3. Runs the pure reducer to get a command list.
 * 4. Executes each command via the executor.
 *
 * All business logic lives in @fyndstigen/shared/stripe-webhook (pure reducer)
 * and execute.ts (executor). This file only wires them together.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { stripe } from '../_shared/stripe.ts'
import { getSupabaseAdmin } from '../_shared/auth.ts'
import { createSupabaseBookingRepo } from '@fyndstigen/shared/adapters/supabase/booking-repo.ts'
import { interpretWebhookEvent } from '@fyndstigen/shared/stripe-webhook.ts'
import { executeCommand, type WebhookRepos } from './execute.ts'
import { prefetchLookups } from './lookups.ts'
import { createSupabaseStripeAccountRepo } from '@fyndstigen/shared/adapters/supabase/stripe-account-repo.ts'
import { createSupabaseSubscriptionRepo } from '@fyndstigen/shared/adapters/supabase/subscription-repo.ts'
import type Stripe from 'https://esm.sh/stripe@17?target=deno'

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

/** Injectable deps for testing. */
export interface WebhookDeps {
  verifier: {
    constructEventAsync(body: string, sig: string, secret: string): Promise<Stripe.Event>
  }
  repos: WebhookRepos
  webhookSecret: string
}

/** Testable handler — extracted so the shell test can call it directly. */
export async function handleWebhook(req: Request, deps: WebhookDeps): Promise<Response> {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('Missing signature', { status: 400 })

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await deps.verifier.constructEventAsync(body, sig, deps.webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return new Response(`Webhook Error: ${msg}`, { status: 400 })
  }

  const lookups = await prefetchLookups(event, deps.repos)
  const commands = interpretWebhookEvent({ event, lookups, now: new Date() })

  try {
    for (const cmd of commands) {
      await executeCommand(cmd, deps.repos)
    }
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    deps.repos.logger.error('webhook execute failed', { err, eventId: event.id })
    return new Response('DB error', { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Production entry point
// ---------------------------------------------------------------------------

serve(async (req) => {
  const admin = getSupabaseAdmin()
  const repos: WebhookRepos = {
    bookings: createSupabaseBookingRepo(admin),
    stripeAccounts: createSupabaseStripeAccountRepo(admin),
    subscriptions: createSupabaseSubscriptionRepo(admin),
    logger: {
      info: (msg, ctx) => console.log(JSON.stringify({ level: 'info', msg, ...(ctx ?? {}) })),
      warn: (msg, ctx) => console.warn(JSON.stringify({ level: 'warn', msg, ...(ctx ?? {}) })),
      error: (msg, ctx) => console.error(JSON.stringify({ level: 'error', msg, ...(ctx ?? {}) })),
    },
  }
  const deps: WebhookDeps = {
    verifier: stripe.webhooks,
    repos,
    webhookSecret,
  }
  return handleWebhook(req, deps)
})
