import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client for Server Components, Route Handlers, and
 * Server Actions. Reads + writes the session cookies via Next's `cookies()`
 * helper so middleware-refreshed tokens flow through correctly.
 *
 * For purely public data (no auth state needed) you can also call this —
 * it just won't have a user. For service-role operations use the edge
 * functions, never this client.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    // Build-time SSG passes through with a placeholder; the actual
    // deployment env always has these.
    return createServerClient(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder',
      { cookies: { getAll: () => [], setAll: () => {} } },
    )
  }

  const cookieStore = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        // Server Components can't set cookies — middleware does that.
        // The setAll callback is invoked when supabase-js refreshes the
        // session; in a Server Component context the writes silently
        // no-op because cookieStore is read-only there. That's expected.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Read-only cookie store (Server Component). No-op.
        }
      },
    },
  })
}
