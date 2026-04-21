import { z } from 'https://esm.sh/zod@4.3.6'
import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError, NotFoundError } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'
import { calculateStripeAmounts, resolveBookingOutcome } from '../_shared/pricing.ts'

// Input/output contracts — mirror of packages/shared/src/contracts/booking-create.ts.
// Kept duplicated (not imported) because this file runs on Deno via esm.sh and
// cannot resolve the workspace package. Keep the two in sync — same rule as
// _shared/pricing.ts mirroring packages/shared/src/booking.ts.
const Input = z.object({
  marketTableId: z.string().min(1),
  fleaMarketId: z.string().min(1),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD'),
  message: z.string().optional(),
})

const Output = z.object({
  bookingId: z.string().min(1),
  clientSecret: z.string().optional(),
})

defineEndpoint({
  name: 'booking-create',
  input: Input,
  output: Output,
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

    // Create PaymentIntent if needed
    let paymentIntentId: string | null = null
    let clientSecret: string | null = null

    if (outcome.needsStripe && stripeAccountId) {
      const { totalOre, applicationFeeOre } = calculateStripeAmounts(table.price_sek)
      const idempotencyKey = `${user.id}-${marketTableId}-${bookingDate}-${Date.now()}`
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalOre,
        currency: 'sek',
        capture_method: outcome.captureMethod!,
        application_fee_amount: applicationFeeOre,
        transfer_data: { destination: stripeAccountId },
        metadata: {
          market_table_id: marketTableId,
          flea_market_id: fleaMarketId,
          booked_by: user.id,
          booking_date: bookingDate,
        },
      }, { idempotencyKey })
      paymentIntentId = paymentIntent.id
      clientSecret = paymentIntent.client_secret
    }

    // Create booking
    const { data: booking, error: bookingErr } = await admin
      .from('bookings')
      .insert({
        market_table_id: marketTableId,
        flea_market_id: fleaMarketId,
        booked_by: user.id,
        booking_date: bookingDate,
        status: outcome.status,
        price_sek: priceSek,
        commission_sek: commissionSek,
        commission_rate: commissionRate,
        message: message || null,
        stripe_payment_intent_id: paymentIntentId,
        payment_status: outcome.paymentStatus,
        expires_at: outcome.expiresAt,
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

// TODO: add a Deno test for this endpoint once a Deno test runner is wired up
// in the monorepo (out of scope for RFC #15).
