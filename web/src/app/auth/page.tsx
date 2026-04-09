'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'

export default function AuthPage() {
  const router = useRouter()
  const { user, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')

  useEffect(() => {
    if (user) router.push('/')
  }, [user, router])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
      }
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 sm:py-24">
      <div className="vintage-card p-8 sm:p-10 animate-fade-up">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <FyndstigenLogo size={52} className="text-espresso" />
        </div>

        <h1 className="font-display text-2xl font-bold text-center">
          {mode === 'signin' ? 'Välkommen tillbaka' : 'Skapa konto'}
        </h1>
        <p className="text-sm text-espresso/50 text-center mt-2 max-w-xs mx-auto">
          {mode === 'signin'
            ? 'Logga in för att hantera dina loppisar och fynd.'
            : 'Börja publicera dina loppisar och nå fler besökare.'}
        </p>

        {/* Mode toggle */}
        <div className="flex gap-1 mt-8 mb-6 bg-cream-warm rounded-xl p-1">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === m
                  ? 'bg-card text-espresso shadow-sm'
                  : 'text-espresso/40 hover:text-espresso/60'
              }`}
            >
              {m === 'signin' ? 'Logga in' : 'Skapa konto'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="text-sm font-semibold block mb-2 text-espresso/70">
              E-post
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="namn@mail.se"
              className="w-full h-12 rounded-xl bg-parchment px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 focus:shadow-[0_0_0_3px_rgba(196,91,53,0.08)] transition-all duration-200 placeholder:text-espresso/25"
            />
          </div>
          <div>
            <label className="text-sm font-semibold block mb-2 text-espresso/70">
              Lösenord
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minst 6 tecken"
              className="w-full h-12 rounded-xl bg-parchment px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 focus:shadow-[0_0_0_3px_rgba(196,91,53,0.08)] transition-all duration-200 placeholder:text-espresso/25"
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
            className="h-12 rounded-xl bg-rust text-parchment font-semibold text-sm hover:bg-rust-light transition-colors duration-200 disabled:opacity-50 shadow-sm mt-1"
          >
            {loading
              ? 'Vänta...'
              : mode === 'signin'
                ? 'Logga in'
                : 'Skapa konto'}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-espresso/30 mt-6">
        Varje stig leder till ett fynd.
      </p>
    </div>
  )
}
