/**
 * AuthPort — abstraction over Supabase Auth for session management.
 *
 * The web app uses `AuthWithRedirect` (web/src/lib/auth/auth-with-redirect.ts),
 * which wraps this port and injects `redirectTo` from `window.location.origin`.
 * Tests and edge functions use the raw `AuthPort` (supabase adapter).
 */

export type AuthUser = {
  id: string
  email: string
}

export interface AuthPort {
  getSession(): Promise<{ user: AuthUser | null }>
  onAuthStateChange(cb: (user: AuthUser | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(
    email: string,
    password: string,
    metadata?: Record<string, string>,
    emailRedirectTo?: string,
  ): Promise<{ needsEmailConfirmation: boolean }>
  signInWithGoogle(redirectTo?: string): Promise<void>
  signOut(): Promise<void>
  resetPasswordForEmail(email: string, redirectTo: string): Promise<void>
  updatePassword(password: string): Promise<void>
}
