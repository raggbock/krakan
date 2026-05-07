import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthPort, AuthUser } from '../../ports/auth'

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

    async signUp(email, password, metadata, emailRedirectTo) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          ...(metadata ? { data: metadata } : {}),
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
        },
      })
      if (error) throw error
      return { needsEmailConfirmation: !data.session }
    },

    async signInWithGoogle(redirectTo?: string) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo ?? window.location.origin,
        },
      })
      if (error) throw error
    },

    async signOut() {
      await supabase.auth.signOut()
    },

    async resetPasswordForEmail(email, redirectTo) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw error
    },

    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
  }
}
