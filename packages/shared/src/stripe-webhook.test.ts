/**
 * Tests for the pure Stripe webhook event reducer.
 * All inputs are hand-built Stripe.Event fixtures — no runtime Stripe SDK
 * required.
 */
import { describe, it, expect } from 'vitest'
import type Stripe from 'stripe'
import { interpretWebhookEvent } from './stripe-webhook'
import type { WebhookLookups } from './stripe-webhook'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeEvent<T extends Stripe.Event['type']>(
  type: T,
  object: Record<string, unknown>,
): Stripe.Event {
  return {
    id: 'evt_test',
    object: 'event',
    api_version: '2024-04-10',
    created: 1234567890,
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type,
    data: { object: object as Stripe.Event['data']['object'] },
  } as Stripe.Event
}

const now = new Date('2026-05-01T12:00:00Z')

const withBooking: WebhookLookups = {
  bookingByPaymentIntent: {
    id: 'bk-1',
    marketId: 'fm-1',
    autoAccept: true,
  },
}

const withManualBooking: WebhookLookups = {
  bookingByPaymentIntent: {
    id: 'bk-1',
    marketId: 'fm-1',
    autoAccept: false,
  },
}

const noBooking: WebhookLookups = {
  bookingByPaymentIntent: null,
}

// ---------------------------------------------------------------------------
// payment_intent.succeeded
// ---------------------------------------------------------------------------

describe('payment_intent.succeeded', () => {
  it('auto-accept market → booking.markPaid { autoAccept: true }', () => {
    const event = makeEvent('payment_intent.succeeded', {
      id: 'pi_abc',
      status: 'succeeded',
    })
    const commands = interpretWebhookEvent({ event, lookups: withBooking, now })
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      type: 'booking.markPaid',
      bookingId: 'bk-1',
      autoAccept: true,
      paymentIntentId: 'pi_abc',
    })
  })

  it('manual market → booking.markPaid { autoAccept: false }', () => {
    const event = makeEvent('payment_intent.succeeded', {
      id: 'pi_abc',
      status: 'succeeded',
    })
    const commands = interpretWebhookEvent({ event, lookups: withManualBooking, now })
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      type: 'booking.markPaid',
      bookingId: 'bk-1',
      autoAccept: false,
    })
  })

  it('no booking lookup → noop', () => {
    const event = makeEvent('payment_intent.succeeded', {
      id: 'pi_abc',
      status: 'succeeded',
    })
    const commands = interpretWebhookEvent({ event, lookups: noBooking, now })
    expect(commands).toHaveLength(1)
    expect(commands[0].type).toBe('noop')
  })
})

// ---------------------------------------------------------------------------
// payment_intent.payment_failed
// ---------------------------------------------------------------------------

describe('payment_intent.payment_failed', () => {
  it('with booking → booking.markPaymentFailed', () => {
    const event = makeEvent('payment_intent.payment_failed', {
      id: 'pi_abc',
      last_payment_error: { message: 'Card declined' },
    })
    const commands = interpretWebhookEvent({ event, lookups: withBooking, now })
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      type: 'booking.markPaymentFailed',
      bookingId: 'bk-1',
      reason: 'Card declined',
    })
  })

  it('no booking → noop', () => {
    const event = makeEvent('payment_intent.payment_failed', {
      id: 'pi_abc',
      last_payment_error: null,
    })
    const commands = interpretWebhookEvent({ event, lookups: noBooking, now })
    expect(commands).toHaveLength(1)
    expect(commands[0].type).toBe('noop')
  })
})

// ---------------------------------------------------------------------------
// payment_intent.canceled
// ---------------------------------------------------------------------------

describe('payment_intent.canceled', () => {
  it('with booking → booking.markCanceled', () => {
    const event = makeEvent('payment_intent.canceled', {
      id: 'pi_abc',
    })
    const commands = interpretWebhookEvent({ event, lookups: withBooking, now })
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      type: 'booking.markCanceled',
      bookingId: 'bk-1',
    })
  })

  it('no booking → noop', () => {
    const event = makeEvent('payment_intent.canceled', {
      id: 'pi_abc',
    })
    const commands = interpretWebhookEvent({ event, lookups: noBooking, now })
    expect(commands).toHaveLength(1)
    expect(commands[0].type).toBe('noop')
  })
})

// ---------------------------------------------------------------------------
// account.updated
// ---------------------------------------------------------------------------

describe('account.updated', () => {
  it('all flags true → account.setOnboarding { complete: true }', () => {
    const event = makeEvent('account.updated', {
      id: 'acct_123',
      charges_enabled: true,
      details_submitted: true,
      payouts_enabled: true,
    })
    const commands = interpretWebhookEvent({ event, lookups: {}, now })
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      type: 'account.setOnboarding',
      stripeAccountId: 'acct_123',
      complete: true,
      chargesEnabled: true,
      payoutsEnabled: true,
    })
  })

  it('partial flags → complete: false', () => {
    const event = makeEvent('account.updated', {
      id: 'acct_123',
      charges_enabled: true,
      details_submitted: false,
      payouts_enabled: false,
    })
    const commands = interpretWebhookEvent({ event, lookups: {}, now })
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      type: 'account.setOnboarding',
      stripeAccountId: 'acct_123',
      complete: false,
    })
  })
})

// ---------------------------------------------------------------------------
// checkout.session.completed
// ---------------------------------------------------------------------------

describe('checkout.session.completed', () => {
  it('mode=subscription with metadata.user_id → subscription.setTier { lookup: { userId } }', () => {
    const event = makeEvent('checkout.session.completed', {
      id: 'cs_abc',
      mode: 'subscription',
      subscription: 'sub_1',
      metadata: { user_id: 'user-42' },
      customer: 'cus_1',
    })
    const commands = interpretWebhookEvent({ event, lookups: {}, now })
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      type: 'subscription.setTier',
      lookup: { userId: 'user-42' },
      tier: 1,
      subscriptionId: 'sub_1',
    })
  })

  it('mode=subscription with no metadata, has customer string → lookup: { customerId }', () => {
    const event = makeEvent('checkout.session.completed', {
      id: 'cs_abc',
      mode: 'subscription',
      subscription: 'sub_1',
      metadata: {},
      customer: 'cus_99',
    })
    const commands = interpretWebhookEvent({ event, lookups: {}, now })
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      type: 'subscription.setTier',
      lookup: { customerId: 'cus_99' },
      tier: 1,
    })
  })

  it('mode=subscription with no metadata and no customer string → log.warn', () => {
    const event = makeEvent('checkout.session.completed', {
      id: 'cs_abc',
      mode: 'subscription',
      subscription: 'sub_1',
      metadata: {},
      customer: null,
    })
    const commands = interpretWebhookEvent({ event, lookups: {}, now })
    expect(commands).toHaveLength(1)
    expect(commands[0].type).toBe('log.warn')
  })

  it('mode=payment → noop', () => {
    const event = makeEvent('checkout.session.completed', {
      id: 'cs_abc',
      mode: 'payment',
      metadata: {},
    })
    const commands = interpretWebhookEvent({ event, lookups: {}, now })
    expect(commands).toHaveLength(1)
    expect(commands[0].type).toBe('noop')
  })
})

// ---------------------------------------------------------------------------
// customer.subscription.deleted
// ---------------------------------------------------------------------------

describe('customer.subscription.deleted', () => {
  it('customer string → subscription.setTier { tier: 0, lookup: { customerId } }', () => {
    const event = makeEvent('customer.subscription.deleted', {
      id: 'sub_abc',
      customer: 'cus_55',
    })
    const commands = interpretWebhookEvent({ event, lookups: {}, now })
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      type: 'subscription.setTier',
      lookup: { customerId: 'cus_55' },
      tier: 0,
    })
  })

  it('no customer string → noop', () => {
    const event = makeEvent('customer.subscription.deleted', {
      id: 'sub_abc',
      customer: null,
    })
    const commands = interpretWebhookEvent({ event, lookups: {}, now })
    expect(commands).toHaveLength(1)
    expect(commands[0].type).toBe('noop')
  })
})

// ---------------------------------------------------------------------------
// invoice.payment_failed
// ---------------------------------------------------------------------------

describe('invoice.payment_failed', () => {
  it('→ log.warn with invoiceId and customerId in context', () => {
    const event = makeEvent('invoice.payment_failed', {
      id: 'in_abc',
      customer: 'cus_77',
    })
    const commands = interpretWebhookEvent({ event, lookups: {}, now })
    expect(commands).toHaveLength(1)
    const cmd = commands[0]
    expect(cmd.type).toBe('log.warn')
    if (cmd.type === 'log.warn') {
      expect(cmd.msg).toBe('invoice.payment_failed')
      expect(cmd.context).toMatchObject({ invoiceId: 'in_abc', customerId: 'cus_77' })
    }
  })
})

// ---------------------------------------------------------------------------
// Unknown event type
// ---------------------------------------------------------------------------

describe('unknown event type', () => {
  it('→ noop', () => {
    const event = makeEvent('balance.available' as Stripe.Event['type'], { id: 'obj_1' })
    const commands = interpretWebhookEvent({ event, lookups: {}, now })
    expect(commands).toHaveLength(1)
    expect(commands[0].type).toBe('noop')
  })
})
