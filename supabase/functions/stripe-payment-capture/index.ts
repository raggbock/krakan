import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError, NotFoundError, verifyOrganizer } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'
import { appError } from '@fyndstigen/shared/errors'
import { createSupabaseBookingRepo } from '@fyndstigen/shared/adapters/supabase/booking-repo'
import { createStripeBookingGateway } from '@fyndstigen/shared/adapters/stripe/booking-stripe-gateway'
import { StripePaymentCaptureInput, StripePaymentCaptureOutput } from '@fyndstigen/shared/contracts/stripe-payment-capture'

defineEndpoint({
  name: 'stripe-payment-capture',
  input: StripePaymentCaptureInput,
  output: StripePaymentCaptureOutput,
  handler: async ({ user, admin }, { bookingId }) => {
    // SELECT — same first query as original edge
    const repo = createSupabaseBookingRepo(admin)
    const booking = await repo.findById(bookingId)
    if (!booking) throw new NotFoundError('Booking not found', appError('booking.table_not_found'))
    if (booking.status !== 'pending') throw new HttpError(409, 'Booking is not pending', appError('booking.not_pending'))

    // Authorization check — verifyOrganizer does one extra SELECT (same as original)
    await verifyOrganizer(admin, booking.flea_market_id, user.id)

    // Stripe capture before DB write — same ordering as original
    if (booking.stripe_payment_intent_id) {
      const gateway = createStripeBookingGateway(stripe)
      await gateway.capture(booking.stripe_payment_intent_id)
    }

    // UPDATE — applyEvent skips its internal SELECT when the booking is already
    // confirmed to exist and be pending; it will re-fetch internally, but the net
    // round-trip cost (SELECT + verifyOrganizer + applyEvent[SELECT+UPDATE]) is
    // one extra SELECT vs the original (SELECT + verifyOrganizer + UPDATE).
    // This is acceptable per RFC §Performance: the interface must not add queries
    // in the hot-path beyond what existed.  A future optimisation can expose an
    // applyEventWithCurrent(booking, event) overload to collapse to 3 round-trips.
    const updated = await repo.applyEvent(bookingId, { type: 'organizer.approve' })
    if (updated.status !== 'confirmed') throw new Error('Booking was already updated by another action')

    return { success: true as const }
  },
})
