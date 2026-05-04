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
 *
 * NOTE(perf/supabase-realtime): Bundle analysis (2026-05-02) suggested
 * switching to createBrowserClient from @supabase/ssr to save ~60 KB of
 * realtime code.  This file already uses createBrowserClient — but
 * investigation shows it internally calls createClient() from
 * @supabase/supabase-js (peer dep), which always bundles @supabase/realtime-js.
 * The realtime-js module is therefore unavoidable with the current
 * @supabase/ssr@0.x + @supabase/supabase-js@2.x dependency tree.
 * No further changes possible without removing the supabase-js peer dep.
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
