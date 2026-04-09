import { createClient, SupabaseClient } from '@supabase/supabase-js'

function initClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && key) {
    return createClient(url, key)
  }
  // During SSG prerendering, env vars may not be available.
  // Return a dummy client that will fail at runtime but not at build time.
  return createClient('https://placeholder.supabase.co', 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder')
}

export const supabase = initClient()
