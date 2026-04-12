import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'
import { stripe } from '../_shared/stripe.ts'
import { getUser, getSupabaseAdmin } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const { user } = await getUser(req.headers.get('Authorization'))
    const admin = getSupabaseAdmin()
    const body = await req.json()
    const { marketTableId, fleaMarketId, bookingDate, message } = body as {
      marketTableId: string
      fleaMarketId: string
      bookingDate: string
      message?: string
    }

    // Get market table for price
    const { data: table, error: tableErr } = await admin
      .from('market_tables')
      .select('price_sek, flea_market_id')
      .eq('id', marketTableId)
      .single()
    if (tableErr || !table) throw new Error('Table not found')
    if (table.flea_market_id !== fleaMarketId) throw new Error('Table does not belong to market')

    // Get organizer's Stripe account
    const { data: market } = await admin
      .from('flea_markets')
      .select('organizer_id')
      .eq('id', fleaMarketId)
      .single()
    if (!market) throw new Error('Market not found')

    const { data: stripeAccount } = await admin
      .from('stripe_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('organizer_id', market.organizer_id)
      .single()
    if (!stripeAccount?.onboarding_complete) throw new Error('Organizer has not completed Stripe setup')

    // Calculate amounts (in ore — Stripe uses smallest currency unit)
    const priceSek = table.price_sek
    const commissionRate = 0.12
    const commissionSek = Math.round(priceSek * commissionRate)
    const totalOre = (priceSek + commissionSek) * 100
    const applicationFeeOre = commissionSek * 100

    // Create PaymentIntent with manual capture
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalOre,
      currency: 'sek',
      capture_method: 'manual',
      application_fee_amount: applicationFeeOre,
      transfer_data: {
        destination: stripeAccount.stripe_account_id,
      },
      metadata: {
        market_table_id: marketTableId,
        flea_market_id: fleaMarketId,
        booked_by: user.id,
        booking_date: bookingDate,
      },
    })

    // Create booking in DB
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

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
        stripe_payment_intent_id: paymentIntent.id,
        payment_status: 'requires_capture',
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single()
    if (bookingErr) throw bookingErr

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        bookingId: booking.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
