import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAuth } from './supabase-auth'
import { createSupabaseServerData } from './supabase-server'
import type { AuthPort } from '../ports/auth'
import type { ServerDataPort } from '../ports/server'

export { createSupabaseAuth } from './supabase-auth'
export { createSupabaseServerData } from './supabase-server'

export function createSupabaseAdapters(supabase: SupabaseClient): {
  auth: AuthPort
  server: ServerDataPort
} {
  return {
    auth: createSupabaseAuth(supabase),
    server: createSupabaseServerData(supabase),
  }
}
