import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError, NotFoundError } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'
import { calculateStripeAmounts, isFreePriced, resolveBookingOutcome } from '@fyndstigen/shared/booking'
import { applyBookingEvent } from '@fyndstigen/shared/booking-lifecycle'
import { createStripeBookingGateway } from '@fyndstigen/shared/adapters/stripe/booking-stripe-gateway'
import { BookingCreateInput, BookingCreateOutput } from '@fyndstigen/shared/contracts/booking-create'

defineEndpoint({
  name: 'booking-create',
  input: BookingCreateInput,
  output: BookingCreateOutput,
  handler: async ({ user, admin }, { marketTableId, fleaMarketId, bookingDate, message }) => {
    // Get market table for price
    const { data: table, error: tableErr } = await admin
      .from('market_tables')
      .select('price_sek, flea_market_id')
      .eq('id', marketTableId)
      .single()
    if (tableErr || !table) throw new NotFoundError('Table not found')
    if (table.flea_market_id !== fleaMarketId) throw new Error('Table does not belong to market')

    // Get market for auto_accept and organizer — must be published and not deleted
    const { data: market } = await admin
      .from('flea_markets')
      .select('organizer_id, auto_accept_bookings')
      .eq('id', fleaMarketId)
      .not('published_at', 'is', null)
      .eq('is_deleted', false)
      .single()
    if (!market) throw new NotFoundError('Market not found or not published')

    // Resolve what kind of booking this is
    const outcome = resolveBookingOutcome(table.price_sek, market.auto_accept_bookings)

    // If paid, require Stripe account
    let stripeAccountId: string | null = null
    if (outcome.needsStripe) {
      const { data: stripeAccount } = await admin
        .from('stripe_accounts')
        .select('stripe_account_id, onboarding_complete')
        .eq('organizer_id', market.organizer_id)
        .single()
      if (!stripeAccount?.onboarding_complete) {
        throw new Error('Organizer has not completed Stripe setup')
      }
      stripeAccountId = stripeAccount.stripe_account_id
    }

    // Idempotency: check for existing pending/confirmed booking
    const { data: existingBooking } = await admin
      .from('bookings')
      .select('id')
      .eq('market_table_id', marketTableId)
      .eq('booked_by', user.id)
      .eq('booking_date', bookingDate)
      .in('status', ['pending', 'confirmed'])
      .single()
    if (existingBooking) throw new HttpError(400, 'Du har redan en bokning för detta bord och datum')

    // Calculate amounts
    const { priceSek, commissionSek, commissionRate } = calculateStripeAmounts(table.price_sek)

    // Create PaymentIntent via gateway (owns fee math + idempotency key composition)
    let paymentIntentId: string | null = null
    let clientSecret: string | null = null

    if (outcome.needsStripe && stripeAccountId) {
      const gateway = createStripeBookingGateway(stripe)
      const idempotencyKey = `${user.id}-${marketTableId}-${bookingDate}-${Date.now()}`
      const pi = await gateway.createPaymentIntentWithFees({
        priceSek: table.price_sek,
        stripeAccountId,
        captureMethod: outcome.captureMethod!,
        idempotencyKey,
        metadata: {
          market_table_id: marketTableId,
          flea_market_id: fleaMarketId,
          booked_by: user.id,
          booking_date: bookingDate,
        },
      })
      paymentIntentId = pi.id
      clientSecret = pi.clientSecret
    }

    // Derive status/payment_status/expires_at via the lifecycle reducer.
    const lifecyclePatch = applyBookingEvent(
      { status: 'pending', stripe_payment_intent_id: paymentIntentId },
      { type: 'created', autoAccept: market.auto_accept_bookings, paid: !isFreePriced(table.price_sek) },
    )

    // Create booking
    const { data: booking, error: bookingErr } = await admin
      .from('bookings')
      .insert({
        market_table_id: marketTableId,
        flea_market_id: fleaMarketId,
        booked_by: user.id,
        booking_date: bookingDate,
        price_sek: priceSek,
        commission_sek: commissionSek,
        commission_rate: commissionRate,
        message: message || null,
        stripe_payment_intent_id: paymentIntentId,
        ...lifecyclePatch,
      })
      .select('id')
      .single()
    if (bookingErr) throw bookingErr

    // Return clientSecret only when Stripe is involved
    return clientSecret
      ? { bookingId: booking.id, clientSecret }
      : { bookingId: booking.id }
  },
})
