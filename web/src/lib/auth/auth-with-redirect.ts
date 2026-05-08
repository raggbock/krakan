import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAuth } from '@fyndstigen/shared'
import type { AuthPort } from '@fyndstigen/shared/ports/auth'

/**
 * Auth surface for web callers.
 *
 * Same as `AuthPort` except `signUp` and `resetPasswordForEmail` no longer
 * require a `redirectTo` — the wrapping factory injects one derived from the
 * caller's origin. This is the only added behavior; everything else is a
 * direct passthrough.
 */
export type AuthWithRedirect = Omit<AuthPort, 'signUp' | 'resetPasswordForEmail'> & {
  signUp(
    email: string,
    password: string,
    metadata?: Record<string, string>,
  ): Promise<{ needsEmailConfirmation: boolean }>
  resetPasswordForEmail(email: string): Promise<void>
}

/**
 * Wrap an `AuthPort` (or a Supabase client) so `signUp` and
 * `resetPasswordForEmail` derive their `redirectTo` from the injected
 * `originProvider`. Tests can inject a stub origin; the production caller
 * passes `() => window.location.origin`.
 */
export function createAuthWithRedirect(
  supabase: SupabaseClient,
  originProvider: () => string,
): AuthWithRedirect {
  return wrapAuth(createSupabaseAuth(supabase), originProvider)
}

/**
 * Same as `createAuthWithRedirect` but accepts an existing `AuthPort` —
 * exposed so unit tests can drive the wrap without touching Supabase.
 */
export function wrapAuth(
  port: AuthPort,
  originProvider: () => string,
): AuthWithRedirect {
  return {
    getSession: port.getSession.bind(port),
    onAuthStateChange: port.onAuthStateChange.bind(port),
    signIn: port.signIn.bind(port),
    signInWithGoogle: port.signInWithGoogle.bind(port),
    signOut: port.signOut.bind(port),
    updatePassword: port.updatePassword.bind(port),
    signUp: (email, password, metadata) =>
      port.signUp(email, password, metadata, `${originProvider()}/auth`),
    resetPasswordForEmail: (email) =>
      port.resetPasswordForEmail(email, `${originProvider()}/auth/reset-password`),
  }
}
