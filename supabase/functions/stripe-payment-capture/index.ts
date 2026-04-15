import { createHandler, NotFoundError, verifyOrganizer } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'

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

  const { error: updateErr } = await admin
    .from('bookings')
    .update({ status: 'confirmed', payment_status: 'captured' })
    .eq('id', bookingId)
  if (updateErr) throw updateErr

  return { success: true }
})
