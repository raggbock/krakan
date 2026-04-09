export type AuthUser = {
  id: string
  email: string
}

export interface AuthPort {
  getSession(): Promise<{ user: AuthUser | null }>
  onAuthStateChange(cb: (user: AuthUser | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string, metadata?: Record<string, string>): Promise<void>
  signOut(): Promise<void>
}
