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
  ) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
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
    await auth.signUp(email, password, metadata)
  }

  async function signOut() {
    await auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
