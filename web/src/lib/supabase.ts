import { createClient, SupabaseClient } from '@supabase/supabase-js'

function initClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && key) {
    return createClient(url, key)
  }
  // Allow build-time SSG to proceed with a placeholder, but fail loudly
  // in the browser where missing env vars indicate a real misconfiguration.
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-restricted-syntax -- configuration invariant: missing env vars at runtime means a broken deployment
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return createClient('https://placeholder.supabase.co', 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder')
}

export const supabase = initClient()
