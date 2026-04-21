'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import type { AuthUser } from '@fyndstigen/shared'
import { auth } from './api'

type AuthState = {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (
    email: string,
    password: string,
    metadata?: Record<string, string>,
  ) => Promise<{ needsEmailConfirmation: boolean }>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => ({ needsEmailConfirmation: false }),
  signInWithGoogle: async () => {},
  signOut: async () => {},
  resetPasswordForEmail: async () => {},
  updatePassword: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    auth.getSession().then(({ user: u }) => {
      setUser(u)
      setLoading(false)
    })

    const unsubscribe = auth.onAuthStateChange(setUser)
    return unsubscribe
  }, [])

  async function signIn(email: string, password: string) {
    await auth.signIn(email, password)
  }

  async function signUp(
    email: string,
    password: string,
    metadata?: Record<string, string>,
  ) {
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined
    return auth.signUp(email, password, metadata, redirectTo)
  }

  async function signInWithGoogle() {
    await auth.signInWithGoogle()
  }

  async function signOut() {
    await auth.signOut()
  }

  async function resetPasswordForEmail(email: string) {
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/reset-password`
        : ''
    await auth.resetPasswordForEmail(email, redirectTo)
  }

  async function updatePassword(password: string) {
    await auth.updatePassword(password)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut, resetPasswordForEmail, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
