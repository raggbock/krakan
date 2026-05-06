/**
 * Stripe webhook command executor.
 *
 * Takes a WebhookCommand produced by the pure reducer and dispatches it to
 * the appropriate repo method. This module has I/O but no Stripe-shape logic —
 * all event discrimination lives in the reducer.
 */

import type { WebhookCommand } from '@fyndstigen/shared/stripe-webhook.ts'
import type { BookingRepo } from '@fyndstigen/shared/ports/booking-repo.ts'
import type { StripeAccountRepo } from '@fyndstigen/shared/ports/stripe-account-repo.ts'
import type { SubscriptionRepo } from '@fyndstigen/shared/ports/subscription-repo.ts'
import type { Logger } from '@fyndstigen/shared/ports/logger.ts'
import type { BookingEvent } from '@fyndstigen/shared/booking-lifecycle.ts'

export interface WebhookRepos {
  bookings: BookingRepo
  stripeAccounts: StripeAccountRepo
  subscriptions: SubscriptionRepo
  logger: Logger
}

export async function executeCommand(cmd: WebhookCommand, repos: WebhookRepos): Promise<void> {
  switch (cmd.type) {
    case 'booking.markPaid': {
      const event: BookingEvent = {
        type: 'stripe.payment_intent.succeeded',
        autoAccept: cmd.autoAccept,
      }
      await repos.bookings.applyEvent(cmd.bookingId, event)
      return
    }

    case 'booking.markPaymentFailed': {
      const event: BookingEvent = { type: 'stripe.payment_intent.failed' }
      await repos.bookings.applyEvent(cmd.bookingId, event)
      return
    }

    case 'booking.markCanceled': {
      const event: BookingEvent = { type: 'stripe.payment_intent.canceled' }
      await repos.bookings.applyEvent(cmd.bookingId, event)
      return
    }

    case 'account.setOnboarding': {
      await repos.stripeAccounts.setOnboardingComplete(cmd.stripeAccountId, cmd.complete)
      return
    }

    case 'subscription.setTier': {
      if ('userId' in cmd.lookup) {
        await repos.subscriptions.setTierByUserId(cmd.lookup.userId, cmd.tier)
      } else {
        await repos.subscriptions.setTierByCustomerId(cmd.lookup.customerId, cmd.tier)
      }
      return
    }

    case 'log.warn': {
      repos.logger.warn(cmd.msg, cmd.context)
      return
    }

    case 'log.info': {
      repos.logger.info(cmd.msg, cmd.context)
      return
    }

    case 'noop':
      return
  }
}
