import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { stripe } from '../_shared/stripe.ts'
import { getSupabaseAdmin } from '../_shared/auth.ts'

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

  const body = await req.text()
  let event

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(`Webhook Error: ${message}`, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  switch (event.type) {
    case 'account.updated': {
      const account = event.data.object
      if (account.charges_enabled && account.details_submitted) {
        await admin
          .from('stripe_accounts')
          .update({ onboarding_complete: true })
          .eq('stripe_account_id', account.id)
      }
      break
    }

    case 'payment_intent.canceled': {
      const pi = event.data.object
      await admin
        .from('bookings')
        .update({ payment_status: 'cancelled' })
        .eq('stripe_payment_intent_id', pi.id)
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object
      await admin
        .from('bookings')
        .update({ payment_status: 'failed' })
        .eq('stripe_payment_intent_id', pi.id)
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
