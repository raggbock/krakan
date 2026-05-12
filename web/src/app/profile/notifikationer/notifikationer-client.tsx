'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { supabase } from '@/lib/supabase'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'

type Props = {
  initialEmailDigestEnabled: boolean
  userId: string
}

export function NotifikationerClient({ initialEmailDigestEnabled, userId }: Props) {
  const posthog = usePostHog()
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(initialEmailDigestEnabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    const nextValue = !emailDigestEnabled
    setSaving(true)
    setError(null)

    try {
      // Upsert so the prefs row is created if it doesn't exist yet
      const { error: upsertError } = await supabase
        .from('user_notification_prefs')
        .upsert({ user_id: userId, email_digest_enabled: nextValue }, { onConflict: 'user_id' })

      if (upsertError) throw upsertError

      setEmailDigestEnabled(nextValue)

      // Telemetry: emit when toggling off
      if (!nextValue) {
        posthog?.capture('digest_unsubscribed', { method: 'profile_toggle' })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel. Försök igen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 text-sm text-espresso/60 hover:text-espresso transition-colors mb-6"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Tillbaka till profil
      </Link>

      <h1 className="font-display text-2xl font-bold mb-2">Notifikationsinställningar</h1>
      <p className="text-sm text-espresso/65 mb-8">
        Styr hur du vill bli informerad om nyheter från loppisar och städer du följer.
      </p>

      <div className="vintage-card p-8 animate-fade-up">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rust/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-rust">
                <path
                  d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6V9.5L2 11H14L12.5 9.5V6C12.5 3.5 10.5 1.5 8 1.5Z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
                <path d="M6.5 11C6.5 11.83 7.17 12.5 8 12.5C8.83 12.5 9.5 11.83 9.5 11" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </div>
            <div>
              <h2 className="font-medium text-sm mb-1">E-postsammanfattning varje morgon</h2>
              <p className="text-xs text-espresso/60 leading-relaxed">
                Få ett dagligt e-postmeddelande kl 06:00 med vad som hänt på loppisar och
                städer du följer det senaste dygnet. Tomma dagar skickas inget.
              </p>
            </div>
          </div>

          <button
            onClick={handleToggle}
            disabled={saving}
            aria-pressed={emailDigestEnabled}
            aria-label={emailDigestEnabled ? 'Stäng av e-postsammanfattning' : 'Aktivera e-postsammanfattning'}
            className={`
              relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent
              transition-colors duration-200 focus:outline-none focus-visible:ring-2
              focus-visible:ring-rust focus-visible:ring-offset-2 disabled:opacity-50
              ${emailDigestEnabled ? 'bg-rust' : 'bg-espresso/20'}
            `}
          >
            <span
              className={`
                pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow
                ring-0 transition-transform duration-200
                ${emailDigestEnabled ? 'translate-x-5' : 'translate-x-0'}
              `}
            />
          </button>
        </div>

        {error && (
          <p className="mt-4 text-xs text-error">{error}</p>
        )}

        <div className="mt-4 pt-4 border-t border-cream-warm">
          <p className="text-xs text-espresso/50">
            Status:{' '}
            <span className={emailDigestEnabled ? 'text-forest font-medium' : 'text-espresso/40'}>
              {saving ? 'Sparar...' : emailDigestEnabled ? 'Aktiverad' : 'Inaktiverad'}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-8 vintage-card p-6 animate-fade-up delay-1">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-forest/10 flex items-center justify-center shrink-0 mt-0.5">
            <FyndstigenLogo size={16} className="text-forest" />
          </div>
          <div>
            <h2 className="font-medium text-sm mb-1">In-app-inkorg</h2>
            <p className="text-xs text-espresso/60 leading-relaxed">
              Notiser i appen visas alltid oavsett e-postinställning.
              Klicka på klockan i navigeringen för att se dina senaste notiser.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
