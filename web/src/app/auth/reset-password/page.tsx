'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { updatePassword } = useAuth()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash and emits
    // a PASSWORD_RECOVERY event. We also accept an existing session
    // (user clicked the link while already signed in).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Lösenorden matchar inte')
      return
    }
    setLoading(true)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => router.push('/'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte uppdatera lösenord')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 sm:py-24">
      <div className="vintage-card p-8 sm:p-10 animate-fade-up">
        <div className="flex justify-center mb-6">
          <FyndstigenLogo size={52} className="text-espresso" />
        </div>

        <h1 className="font-display text-2xl font-bold text-center">
          {done ? 'Klart!' : 'Välj nytt lösenord'}
        </h1>

        {done ? (
          <p className="text-sm text-espresso/65 text-center mt-3">
            Ditt lösenord är uppdaterat. Skickar dig vidare...
          </p>
        ) : !ready ? (
          <>
            <p className="text-sm text-espresso/65 text-center mt-3">
              Återställningslänken är ogiltig eller har gått ut.
            </p>
            <Link
              href="/auth"
              className="block mt-6 text-center text-sm font-semibold text-rust hover:text-rust-light transition-colors"
            >
              Begär en ny länk
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-8">
            <div>
              <label className="text-sm font-semibold block mb-2 text-espresso/70">
                Nytt lösenord
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minst 6 tecken"
                className="w-full h-12 rounded-xl bg-parchment px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
              />
            </div>
            <div>
              <label className="text-sm font-semibold block mb-2 text-espresso/70">
                Bekräfta lösenord
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full h-12 rounded-xl bg-parchment px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
              />
            </div>

            {error && (
              <div className="text-sm text-error bg-error/8 border border-error/15 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-12 rounded-xl bg-rust text-white font-semibold text-sm hover:bg-rust-light transition-colors duration-200 disabled:opacity-50 shadow-sm"
            >
              {loading ? 'Uppdaterar...' : 'Spara nytt lösenord'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
