// supabase/functions/stripe-connect-refresh/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'
import { stripe } from '../_shared/stripe.ts'
import { getUser, getSupabaseAdmin } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const { user } = await getUser(req.headers.get('Authorization'))
    const admin = getSupabaseAdmin()

    const { data, error } = await admin
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('organizer_id', user.id)
      .single()

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'No Stripe account found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { origin } = new URL(req.headers.get('origin') || req.url)
    const accountLink = await stripe.accountLinks.create({
      account: data.stripe_account_id,
      refresh_url: `${origin}/profile?stripe=refresh`,
      return_url: `${origin}/profile?stripe=complete`,
      type: 'account_onboarding',
    })

    return new Response(JSON.stringify({ url: accountLink.url }), {
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
