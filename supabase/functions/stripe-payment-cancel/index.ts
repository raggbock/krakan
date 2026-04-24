import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError, ForbiddenError, NotFoundError, verifyOrganizer } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'
import { appError } from '@fyndstigen/shared/errors.ts'
import { createSupabaseBookingRepo } from '@fyndstigen/shared/adapters/supabase/booking-repo.ts'
import { createStripeBookingGateway } from '@fyndstigen/shared/adapters/stripe/booking-stripe-gateway.ts'
import { StripePaymentCancelInput, StripePaymentCancelOutput } from '@fyndstigen/shared/contracts/stripe-payment-cancel.ts'
import type { BookingEvent } from '@fyndstigen/shared/booking-lifecycle.ts'

defineEndpoint({
  name: 'stripe-payment-cancel',
  input: StripePaymentCancelInput,
  output: StripePaymentCancelOutput,
  handler: async ({ user, admin }, { bookingId, newStatus }) => {
    const repo = createSupabaseBookingRepo(admin)
    const booking = await repo.findById(bookingId)
    if (!booking) throw new NotFoundError('Booking not found', appError('booking.not_found'))
    if (booking.status !== 'pending') throw new HttpError(409, 'Booking is not pending', appError('booking.not_pending'))

    // Authorization: organizer can deny, booker can cancel
    if (newStatus === 'denied') {
      await verifyOrganizer(admin, booking.flea_market_id, user.id)
    } else if (newStatus === 'cancelled') {
      if (booking.booked_by !== user.id) throw new ForbiddenError()
    } else {
      throw new HttpError(400, 'Invalid status', appError('booking.invalid_status'))
    }

    // Stripe cancel before DB write — same ordering as original
    if (booking.stripe_payment_intent_id) {
      const gateway = createStripeBookingGateway(stripe)
      await gateway.cancel(booking.stripe_payment_intent_id)
    }

    // Translate newStatus → BookingEvent and apply via repo
    const event: BookingEvent = newStatus === 'denied'
      ? { type: 'organizer.deny' }
      : { type: 'user.cancel' }

    const updated = await repo.applyEvent(bookingId, event)
    if (updated.status !== newStatus) {
      throw new HttpError(409, 'Booking was already updated by another action', appError('booking.concurrent_update'))
    }

    return { success: true as const }
  },
})
