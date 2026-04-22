import { createHandler, NotFoundError, verifyOrganizer } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'
import { applyBookingEvent } from '@fyndstigen/shared/booking-lifecycle'

createHandler(async ({ user, admin, body }) => {
  const { bookingId } = body as { bookingId: string }

  const { data: booking, error: bookingErr } = await admin
    .from('bookings')
    .select('id, status, stripe_payment_intent_id, flea_market_id')
    .eq('id', bookingId)
    .single()
  if (bookingErr || !booking) throw new NotFoundError('Booking not found')
  if (booking.status !== 'pending') throw new Error('Booking is not pending')

  await verifyOrganizer(admin, booking.flea_market_id, user.id)

  if (booking.stripe_payment_intent_id) {
    await stripe.paymentIntents.capture(booking.stripe_payment_intent_id)
  }

  const patch = applyBookingEvent(booking, { type: 'organizer.approve' })

  const { data: updated, error: updateErr } = await admin
    .from('bookings')
    .update(patch)
    .eq('id', bookingId)
    .eq('status', 'pending')
    .select('id')
    .single()
  if (updateErr || !updated) throw new Error('Booking was already updated by another action')

  return { success: true }
})
