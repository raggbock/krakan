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
