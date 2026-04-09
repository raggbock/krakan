import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthPort, AuthUser } from '../ports/auth'

function toAuthUser(supabaseUser: { id: string; email?: string } | null): AuthUser | null {
  if (!supabaseUser) return null
  return { id: supabaseUser.id, email: supabaseUser.email ?? '' }
}

export function createSupabaseAuth(supabase: SupabaseClient): AuthPort {
  return {
    async getSession() {
      const { data: { session } } = await supabase.auth.getSession()
      return { user: toAuthUser(session?.user ?? null) }
    },

    onAuthStateChange(cb) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        cb(toAuthUser(session?.user ?? null))
      })
      return () => subscription.unsubscribe()
    },

    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },

    async signUp(email, password, metadata) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: metadata ? { data: metadata } : undefined,
      })
      if (error) throw error
    },

    async signOut() {
      await supabase.auth.signOut()
    },
  }
}
