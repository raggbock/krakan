import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser-side Supabase client. Stores auth tokens in cookies (set by
 * the @supabase/ssr browser client) instead of localStorage, so a future
 * XSS or third-party script can't read the session out of `window`.
 *
 * The cookies are httpOnly when set by middleware; the browser client
 * still mirrors them locally to satisfy supabase-js's session shape.
 * That mirror is short-lived and refreshed on every navigation by the
 * middleware.
 */
function initClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && key) {
    return createBrowserClient(url, key)
  }
  // Allow build-time SSG to proceed with a placeholder, but fail loudly
  // in the browser where missing env vars indicate a real misconfiguration.
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-restricted-syntax -- configuration invariant: missing env vars at runtime means a broken deployment
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return createBrowserClient(
    'https://placeholder.supabase.co',
    'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder',
  )
}

export const supabase: SupabaseClient = initClient()
