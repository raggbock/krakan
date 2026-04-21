'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'
import { useAuth } from '@/lib/auth-context'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'

export default function AuthPage() {
  const router = useRouter()
  const posthog = usePostHog()
  const { user, signIn, signUp, signInWithGoogle, resetPasswordForEmail } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (user) router.push('/')
  }, [user, router])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signin') {
        await signIn(email, password)
        router.push('/')
      } else if (mode === 'signup') {
        const { needsEmailConfirmation } = await signUp(email, password)
        posthog?.capture('signup_completed', { method: 'email', needs_email_confirmation: needsEmailConfirmation })
        if (needsEmailConfirmation) {
          setConfirmationSent(true)
        } else {
          router.push('/')
        }
      } else {
        await resetPasswordForEmail(email)
        setResetSent(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setLoading(false)
    }
  }

  if (confirmationSent || resetSent) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 sm:py-24">
        <div className="vintage-card p-8 sm:p-10 animate-fade-up text-center">
          <div className="flex justify-center mb-6">
            <FyndstigenLogo size={52} className="text-rust" />
          </div>
          <h1 className="font-display text-2xl font-bold">Kolla din mejl</h1>
          <p className="text-sm text-espresso/65 mt-3">
            {confirmationSent ? (
              <>Vi har skickat en bekräftelselänk till <strong>{email}</strong>. Klicka på länken för att aktivera ditt konto.</>
            ) : (
              <>Vi har skickat en återställningslänk till <strong>{email}</strong>. Klicka på länken för att välja ett nytt lösenord.</>
            )}
          </p>
          <p className="text-xs text-espresso/45 mt-6">
            Hittar du den inte? Kolla i skräpposten.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 sm:py-24">
      <div className="vintage-card p-8 sm:p-10 animate-fade-up">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <FyndstigenLogo size={52} className="text-espresso" />
        </div>

        <h1 className="font-display text-2xl font-bold text-center">
          {mode === 'signin' ? 'Välkommen tillbaka' : mode === 'signup' ? 'Skapa konto' : 'Återställ lösenord'}
        </h1>
        <p className="text-sm text-espresso/65 text-center mt-2 max-w-xs mx-auto">
          {mode === 'signin'
            ? 'Logga in för att hantera dina loppisar och fynd.'
            : mode === 'signup'
              ? 'Börja publicera dina loppisar och nå fler besökare.'
              : 'Skriv in din e-post så skickar vi en länk för att välja nytt lösenord.'}
        </p>

        {/* Mode toggle */}
        {mode !== 'forgot' && (
          <div className="flex gap-1 mt-8 mb-6 bg-cream-warm rounded-xl p-1">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === m
                    ? 'bg-card text-espresso shadow-sm'
                    : 'text-espresso/60 hover:text-espresso/60'
                }`}
              >
                {m === 'signin' ? 'Logga in' : 'Skapa konto'}
              </button>
            ))}
          </div>
        )}

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
          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-espresso/70">
                  Lösenord
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError('') }}
                    className="text-xs font-semibold text-rust hover:text-rust-light transition-colors"
                  >
                    Glömt lösenord?
                  </button>
                )}
              </div>
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
          )}

          {error && (
            <div className="text-sm text-error bg-error/8 border border-error/15 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-xl bg-rust text-white font-semibold text-sm hover:bg-rust-light transition-colors duration-200 disabled:opacity-50 shadow-sm mt-1"
          >
            {loading
              ? 'Vänta...'
              : mode === 'signin'
                ? 'Logga in'
                : mode === 'signup'
                  ? 'Skapa konto'
                  : 'Skicka återställningslänk'}
          </button>

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => { setMode('signin'); setError('') }}
              className="text-xs font-semibold text-espresso/60 hover:text-espresso transition-colors -mt-2"
            >
              ← Tillbaka till inloggning
            </button>
          )}
        </form>

        {mode !== 'forgot' && (
        <>
        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-cream-warm" />
          <span className="text-xs text-espresso/30 font-medium">eller</span>
          <div className="flex-1 h-px bg-cream-warm" />
        </div>

        {/* Google sign-in */}
        <button
          onClick={async () => {
            setGoogleLoading(true)
            setError('')
            try {
              await signInWithGoogle()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Något gick fel')
              setGoogleLoading(false)
            }
          }}
          disabled={googleLoading}
          className="w-full h-12 rounded-xl bg-card border border-cream-warm text-sm font-semibold text-espresso hover:bg-cream-warm/50 transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-3"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 2.58Z" fill="#EA4335"/>
          </svg>
          {googleLoading ? 'Omdirigerar...' : 'Fortsätt med Google'}
        </button>
        </>
        )}
      </div>

      <p className="text-center text-xs text-espresso/30 mt-6">
        Varje stig leder till ett fynd.
      </p>
    </div>
  )
}
