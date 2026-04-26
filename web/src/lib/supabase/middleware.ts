import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refresh the Supabase session cookies on every request.
 *
 * Why this exists: with @supabase/ssr the browser stores auth tokens in
 * cookies (httpOnly when set here), not localStorage. The access token
 * has a 1-hour lifetime; without a periodic refresh the session
 * silently expires mid-navigation. This middleware runs `getUser()`
 * which triggers supabase-js to refresh the token if needed and write
 * the updated cookies back through our setAll() callback.
 *
 * Returns the response with refreshed cookies attached. Caller can
 * append other transforms (redirects, headers) to it.
 */
export async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return response

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Triggers token refresh if the access token is near expiry. The
  // setAll callback above writes the refreshed cookies onto the response.
  await supabase.auth.getUser()

  return response
}
