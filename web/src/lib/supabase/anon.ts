import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cookie-free Supabase client for public, cacheable reads.
 *
 * createSupabaseServerClient() reads the session through `cookies()`, and any
 * request-time API in a route's tree makes Next render it per request — which
 * is why /loppis/[slug] was ƒ Dynamic despite `revalidate = 3600`. This client
 * sees exactly what an anonymous visitor sees under RLS (published markets
 * only), so it is safe to render once and serve from the ISR cache.
 */
export function createSupabaseAnonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  )
}
