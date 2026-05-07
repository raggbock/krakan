/**
 * Executor tests — verifies that each WebhookCommand routes to the correct
 * repo method with the correct arguments.
 *
 * Uses in-memory adapters from @fyndstigen/shared so no Supabase client needed.
 *
 * Run with:
 *   deno test --allow-all --import-map=supabase/functions/deno.json \
 *     supabase/functions/stripe-webhooks/execute.test.ts
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { executeCommand, type WebhookRepos } from './execute.ts'
import type { WebhookCommand } from '@fyndstigen/shared/stripe-webhook.ts'
import type { Logger } from '@fyndstigen/shared/ports/logger.ts'
import type { Booking } from '@fyndstigen/shared/types.ts'

// ---------------------------------------------------------------------------
// In-memory repo stubs
// ---------------------------------------------------------------------------

function makeBookingRepo(opts: { throwOnApply?: boolean } = {}) {
  const calls: Array<{ id: string; event: unknown }> = []
  return {
    async findById() { return null },
    async findByPaymentIntent() { return null },
    async applyEvent(id: string, event: unknown) {
      if (opts.throwOnApply) throw new Error('DB error')
      calls.push({ id, event })
      return {} as Booking
    },
    _calls: calls,
  }
}

function makeStripeAccountRepo() {
  const calls: Array<{ stripeAccountId: string; complete: boolean }> = []
  return {
    async setOnboardingComplete(stripeAccountId: string, complete: boolean) {
      calls.push({ stripeAccountId, complete })
    },
    _calls: calls,
  }
}

function makeSubscriptionRepo() {
  const byUser: Array<{ userId: string; tier: 0 | 1 }> = []
  const byCustomer: Array<{ customerId: string; tier: 0 | 1 }> = []
  return {
    async setTierByUserId(userId: string, tier: 0 | 1) { byUser.push({ userId, tier }) },
    async setTierByCustomerId(customerId: string, tier: 0 | 1) { byCustomer.push({ customerId, tier }) },
    _byUser: byUser,
    _byCustomer: byCustomer,
  }
}

function makeLogger() {
  const warns: Array<{ msg: string; context?: Record<string, unknown> }> = []
  const infos: Array<{ msg: string; context?: Record<string, unknown> }> = []
  const errors: Array<{ msg: string; context?: Record<string, unknown> }> = []
  const logger: Logger = {
    warn(msg, context) { warns.push({ msg, context }) },
    info(msg, context) { infos.push({ msg, context }) },
    error(msg, context) { errors.push({ msg, context }) },
  }
  return { logger, warns, infos, errors }
}

function makeRepos(opts: { throwOnApply?: boolean } = {}): WebhookRepos & {
  bookings: ReturnType<typeof makeBookingRepo>
  stripeAccounts: ReturnType<typeof makeStripeAccountRepo>
  subscriptions: ReturnType<typeof makeSubscriptionRepo>
  logCollector: ReturnType<typeof makeLogger>
} {
  const logCollector = makeLogger()
  return {
    bookings: makeBookingRepo(opts),
    stripeAccounts: makeStripeAccountRepo(),
    subscriptions: makeSubscriptionRepo(),
    logger: logCollector.logger,
    logCollector,
  }
}

// ---------------------------------------------------------------------------
// booking.markPaid
// ---------------------------------------------------------------------------

Deno.test('executeCommand: booking.markPaid with autoAccept=true calls applyEvent with autoAccept', async () => {
  const repos = makeRepos()
  const cmd: WebhookCommand = { type: 'booking.markPaid', bookingId: 'bk-1', autoAccept: true, paymentIntentId: 'pi_1' }
  await executeCommand(cmd, repos)
  assertEquals(repos.bookings._calls.length, 1)
  assertEquals(repos.bookings._calls[0].id, 'bk-1')
  assertEquals((repos.bookings._calls[0].event as { autoAccept: boolean }).autoAccept, true)
})

Deno.test('executeCommand: booking.markPaid with autoAccept=false', async () => {
  const repos = makeRepos()
  const cmd: WebhookCommand = { type: 'booking.markPaid', bookingId: 'bk-2', autoAccept: false, paymentIntentId: 'pi_2' }
  await executeCommand(cmd, repos)
  assertEquals((repos.bookings._calls[0].event as { autoAccept: boolean }).autoAccept, false)
})

// ---------------------------------------------------------------------------
// booking.markPaymentFailed
// ---------------------------------------------------------------------------

Deno.test('executeCommand: booking.markPaymentFailed calls applyEvent with stripe.payment_intent.failed', async () => {
  const repos = makeRepos()
  const cmd: WebhookCommand = { type: 'booking.markPaymentFailed', bookingId: 'bk-3', reason: 'Card declined' }
  await executeCommand(cmd, repos)
  assertEquals(repos.bookings._calls[0].id, 'bk-3')
  assertEquals((repos.bookings._calls[0].event as { type: string }).type, 'stripe.payment_intent.failed')
})

// ---------------------------------------------------------------------------
// booking.markCanceled
// ---------------------------------------------------------------------------

Deno.test('executeCommand: booking.markCanceled calls applyEvent with stripe.payment_intent.canceled', async () => {
  const repos = makeRepos()
  const cmd: WebhookCommand = { type: 'booking.markCanceled', bookingId: 'bk-4' }
  await executeCommand(cmd, repos)
  assertEquals(repos.bookings._calls[0].id, 'bk-4')
  assertEquals((repos.bookings._calls[0].event as { type: string }).type, 'stripe.payment_intent.canceled')
})

// ---------------------------------------------------------------------------
// account.setOnboarding
// ---------------------------------------------------------------------------

Deno.test('executeCommand: account.setOnboarding calls setOnboardingComplete', async () => {
  const repos = makeRepos()
  const cmd: WebhookCommand = { type: 'account.setOnboarding', stripeAccountId: 'acct_1', complete: true, chargesEnabled: true, payoutsEnabled: true }
  await executeCommand(cmd, repos)
  assertEquals(repos.stripeAccounts._calls.length, 1)
  assertEquals(repos.stripeAccounts._calls[0].stripeAccountId, 'acct_1')
  assertEquals(repos.stripeAccounts._calls[0].complete, true)
})

Deno.test('executeCommand: account.setOnboarding complete=false', async () => {
  const repos = makeRepos()
  const cmd: WebhookCommand = { type: 'account.setOnboarding', stripeAccountId: 'acct_2', complete: false, chargesEnabled: false, payoutsEnabled: false }
  await executeCommand(cmd, repos)
  assertEquals(repos.stripeAccounts._calls[0].complete, false)
})

// ---------------------------------------------------------------------------
// subscription.setTier — by userId
// ---------------------------------------------------------------------------

Deno.test('executeCommand: subscription.setTier with userId calls setTierByUserId', async () => {
  const repos = makeRepos()
  const cmd: WebhookCommand = { type: 'subscription.setTier', lookup: { userId: 'user-1' }, tier: 1 }
  await executeCommand(cmd, repos)
  assertEquals(repos.subscriptions._byUser.length, 1)
  assertEquals(repos.subscriptions._byUser[0], { userId: 'user-1', tier: 1 })
  assertEquals(repos.subscriptions._byCustomer.length, 0)
})

// ---------------------------------------------------------------------------
// subscription.setTier — by customerId
// ---------------------------------------------------------------------------

Deno.test('executeCommand: subscription.setTier with customerId calls setTierByCustomerId', async () => {
  const repos = makeRepos()
  const cmd: WebhookCommand = { type: 'subscription.setTier', lookup: { customerId: 'cus_1' }, tier: 0 }
  await executeCommand(cmd, repos)
  assertEquals(repos.subscriptions._byCustomer.length, 1)
  assertEquals(repos.subscriptions._byCustomer[0], { customerId: 'cus_1', tier: 0 })
  assertEquals(repos.subscriptions._byUser.length, 0)
})

// ---------------------------------------------------------------------------
// log.warn
// ---------------------------------------------------------------------------

Deno.test('executeCommand: log.warn calls logger.warn with msg and context', async () => {
  const repos = makeRepos()
  const cmd: WebhookCommand = { type: 'log.warn', msg: 'invoice.payment_failed', context: { invoiceId: 'in_1' } }
  await executeCommand(cmd, repos)
  assertEquals(repos.logCollector.warns.length, 1)
  assertEquals(repos.logCollector.warns[0].msg, 'invoice.payment_failed')
  assertEquals(repos.logCollector.warns[0].context, { invoiceId: 'in_1' })
})

// ---------------------------------------------------------------------------
// log.info
// ---------------------------------------------------------------------------

Deno.test('executeCommand: log.info calls logger.info', async () => {
  const repos = makeRepos()
  const cmd: WebhookCommand = { type: 'log.info', msg: 'test info', context: { foo: 'bar' } }
  await executeCommand(cmd, repos)
  assertEquals(repos.logCollector.infos.length, 1)
  assertEquals(repos.logCollector.infos[0].msg, 'test info')
})

// ---------------------------------------------------------------------------
// noop
// ---------------------------------------------------------------------------

Deno.test('executeCommand: noop makes no repo calls', async () => {
  const repos = makeRepos()
  const cmd: WebhookCommand = { type: 'noop', reason: 'test noop' }
  await executeCommand(cmd, repos)
  assertEquals(repos.bookings._calls.length, 0)
  assertEquals(repos.stripeAccounts._calls.length, 0)
  assertEquals(repos.subscriptions._byUser.length, 0)
  assertEquals(repos.subscriptions._byCustomer.length, 0)
})

// ---------------------------------------------------------------------------
// Repo throws → error surfaces (not swallowed)
// ---------------------------------------------------------------------------

Deno.test('executeCommand: booking repo throw bubbles out', async () => {
  const repos = makeRepos({ throwOnApply: true })
  const cmd: WebhookCommand = { type: 'booking.markPaid', bookingId: 'bk-5', autoAccept: true, paymentIntentId: 'pi_5' }
  await assertRejects(
    () => executeCommand(cmd, repos),
    Error,
    'DB error',
  )
})
