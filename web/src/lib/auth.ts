import { createAuthWithRedirect, type AuthWithRedirect } from './auth-with-redirect'
import { supabase } from './supabase'

export type { AuthWithRedirect }

export const auth: AuthWithRedirect = createAuthWithRedirect(
  supabase,
  () => (typeof window !== 'undefined' ? window.location.origin : ''),
)
