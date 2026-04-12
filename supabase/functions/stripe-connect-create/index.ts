import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'
import { stripe } from '../_shared/stripe.ts'
import { getUser, getSupabaseAdmin } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const { user } = await getUser(req.headers.get('Authorization'))
    const admin = getSupabaseAdmin()

    // Check if account already exists
    const { data: existing } = await admin
      .from('stripe_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('organizer_id', user.id)
      .single()

    let stripeAccountId: string

    if (existing) {
      stripeAccountId = existing.stripe_account_id
    } else {
      // Create new Stripe Connect account
      const account = await stripe.accounts.create({
        type: 'standard',
        country: 'SE',
        email: user.email,
        metadata: { organizer_id: user.id },
      })
      stripeAccountId = account.id

      const { error: insertErr } = await admin
        .from('stripe_accounts')
        .insert({
          organizer_id: user.id,
          stripe_account_id: account.id,
        })
      if (insertErr) throw insertErr
    }

    // Generate Account Link for onboarding
    const { origin } = new URL(req.headers.get('origin') || req.url)
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
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
