import { createHandler, NotFoundError, ForbiddenError, verifyOrganizer } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'

createHandler(async ({ user, admin, body }) => {
  const { bookingId, newStatus } = body as {
    bookingId: string
    newStatus: 'denied' | 'cancelled'
  }

  const { data: booking, error: bookingErr } = await admin
    .from('bookings')
    .select('id, status, stripe_payment_intent_id, flea_market_id, booked_by')
    .eq('id', bookingId)
    .single()
  if (bookingErr || !booking) throw new NotFoundError('Booking not found')
  if (booking.status !== 'pending') throw new Error('Booking is not pending')

  // Authorization: organizer can deny, booker can cancel
  if (newStatus === 'denied') {
    await verifyOrganizer(admin, booking.flea_market_id, user.id)
  } else if (newStatus === 'cancelled') {
    if (booking.booked_by !== user.id) throw new ForbiddenError()
  } else {
    throw new Error('Invalid status')
  }

  if (booking.stripe_payment_intent_id) {
    await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
  }

  const { error: updateErr } = await admin
    .from('bookings')
    .update({ status: newStatus, payment_status: 'cancelled' })
    .eq('id', bookingId)
  if (updateErr) throw updateErr

  return { success: true }
})
