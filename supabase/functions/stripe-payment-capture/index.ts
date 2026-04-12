// supabase/functions/stripe-payment-capture/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'
import { stripe } from '../_shared/stripe.ts'
import { getUser, getSupabaseAdmin } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const { user } = await getUser(req.headers.get('Authorization'))
    const admin = getSupabaseAdmin()
    const { bookingId } = await req.json() as { bookingId: string }

    // Get booking and verify organizer owns the market
    const { data: booking, error: bookingErr } = await admin
      .from('bookings')
      .select('id, status, stripe_payment_intent_id, flea_market_id')
      .eq('id', bookingId)
      .single()
    if (bookingErr || !booking) throw new Error('Booking not found')
    if (booking.status !== 'pending') throw new Error('Booking is not pending')
    if (!booking.stripe_payment_intent_id) throw new Error('No payment intent for this booking')

    // Verify organizer
    const { data: market } = await admin
      .from('flea_markets')
      .select('organizer_id')
      .eq('id', booking.flea_market_id)
      .single()
    if (!market || market.organizer_id !== user.id) throw new Error('Not authorized')

    // Capture payment
    await stripe.paymentIntents.capture(booking.stripe_payment_intent_id)

    // Update booking status
    const { error: updateErr } = await admin
      .from('bookings')
      .update({
        status: 'confirmed',
        payment_status: 'captured',
      })
      .eq('id', bookingId)
    if (updateErr) throw updateErr

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
