/**
 * AuthContext — React context for authentication state.
 *
 * Provides an `AuthState` with:
 *   - `user`    — the currently signed-in `AuthUser`, or null when signed out.
 *   - `loading` — true until the initial session check resolves (prevents
 *                 flash of "unauthenticated" UI on first render).
 *   - `auth`    — the `AuthWithRedirect` singleton for sign-in/out actions.
 *
 * `AuthProvider` subscribes to `auth.onAuthStateChange` so the context stays
 * in sync across tabs and after OAuth redirects. Mount it once at the root
 * layout (alongside `QueryProvider`).
 *
 * Consumers call `useAuth()` — the hook throws if used outside `AuthProvider`.
 */

'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react'
import posthog from 'posthog-js'
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

  // Keep PostHog identity in sync with Supabase auth so analytics can
  // distinguish auth vs anonymous users (see #131). Identify on sign-in,
  // reset on sign-out. Idempotent — posthog.identify dedupes by distinct_id.
  // The ref prevents reset() from running on the initial null→null render.
  const lastUserIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (user?.id && user.id !== lastUserIdRef.current) {
      posthog.identify(user.id, { email: user.email })
      lastUserIdRef.current = user.id
    } else if (!user && lastUserIdRef.current !== null) {
      posthog.reset()
      lastUserIdRef.current = null
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, loading, auth }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
