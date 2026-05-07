'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import type { AuthUser } from '@fyndstigen/shared'
import { auth, type AuthWithRedirect } from './auth'

type AuthState = {
  user: AuthUser | null
  loading: boolean
  auth: AuthWithRedirect
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  auth,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    auth.getSession().then(({ user: u }) => {
      setUser(u)
      setLoading(false)
    })
    return auth.onAuthStateChange(setUser)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, auth }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
