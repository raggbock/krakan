import { createHandler, NotFoundError, ForbiddenError, verifyOrganizer } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'
import { createSupabaseBookingRepo } from '@fyndstigen/shared/adapters/supabase/booking-repo'
import { createStripeBookingGateway } from '@fyndstigen/shared/adapters/stripe/booking-stripe-gateway'
import type { BookingEvent } from '@fyndstigen/shared/booking-lifecycle'

createHandler(async ({ user, admin, body }) => {
  const { bookingId, newStatus } = body as {
    bookingId: string
    newStatus: 'denied' | 'cancelled'
  }

  // SELECT — same first query as original edge
  const repo = createSupabaseBookingRepo(admin)
  const booking = await repo.findById(bookingId)
  if (!booking) throw new NotFoundError('Booking not found')
  if (booking.status !== 'pending') throw new Error('Booking is not pending')

  // Authorization: organizer can deny, booker can cancel
  if (newStatus === 'denied') {
    await verifyOrganizer(admin, booking.flea_market_id, user.id)
  } else if (newStatus === 'cancelled') {
    if (booking.booked_by !== user.id) throw new ForbiddenError()
  } else {
    throw new Error('Invalid status')
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
  if (updated.status !== newStatus) throw new Error('Booking was already updated by another action')

  return { success: true }
})
