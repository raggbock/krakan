// supabase/functions/stripe-connect-status/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'
import { getUser, getSupabaseAdmin } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const { user } = await getUser(req.headers.get('Authorization'))
    const admin = getSupabaseAdmin()

    const { data } = await admin
      .from('stripe_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('organizer_id', user.id)
      .single()

    return new Response(
      JSON.stringify({
        connected: !!data,
        onboarding_complete: data?.onboarding_complete ?? false,
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
