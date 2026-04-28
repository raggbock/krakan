'use client'

import { useState } from 'react'
import { useTakeoverRequest } from '@/hooks/use-takeover'

const ERROR_LABEL: Record<string, string> = {
  market_not_found: 'Den här loppisen hittades inte.',
  market_removed: 'Den här loppisen är borttagen.',
  market_already_claimed: 'Den här loppisen har redan en ägare.',
  too_many_requests_for_market: 'Vi har redan flera förfrågningar för den här loppisen idag. Försök igen i morgon.',
  too_many_requests_for_email: 'Du har skickat flera förfrågningar idag. Försök igen i morgon.',
}

function labelFor(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return ERROR_LABEL[msg] ?? 'Något gick fel. Försök igen om en stund.'
}

/**
 * Self-service "I want to claim this market" button. Shown only on
 * system-owned markets — claimed ones already have an organizer who
 * can edit through the normal authenticated flow.
 *
 * Flow: visitor enters their email + optional relationship note,
 * submission emails admin (hej@), admin reviews, admin issues a real
 * takeover token via /admin/markets if the request looks legit.
 */
export function ClaimMarketButton({ marketId, marketName }: { marketId: string; marketName: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)
  const request = useTakeoverRequest()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await request.mutateAsync({
        marketId,
        email: email.trim().toLowerCase(),
        note: note.trim() || undefined,
      })
      setDone(true)
    } catch { /* surfaced via request.isError */ }
  }

  function reset() {
    setOpen(false)
    setEmail('')
    setNote('')
    setDone(false)
    request.reset()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-sm font-medium text-rust hover:text-rust-light transition-colors"
      >
        🗝️ Är detta din loppis? Ta över sidan
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6"
          onClick={(e) => { if (e.target === e.currentTarget) reset() }}
        >
          <div className="w-full max-w-md bg-card border border-cream-warm rounded-card p-7 shadow-[0_4px_16px_rgba(44,36,29,0.1)]">
            {!done && (
              <>
                <h3 className="font-display text-2xl font-medium tracking-tight mb-2">
                  Ta över {marketName}
                </h3>
                <p className="text-sm text-espresso-light mb-5">
                  Fyll i din e-post så granskar vi din förfrågan inom ett dygn. Om
                  det stämmer skickar vi en länk dit så du kan börja redigera sidan.
                </p>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-bold text-espresso-light mb-1.5">
                      Din e-post
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="namn@domän.se"
                      className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-espresso-light mb-1.5">
                      Vad är din koppling till loppisen?{' '}
                      <span className="font-normal text-espresso/55">(valfritt)</span>
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={500}
                      placeholder="T.ex. 'Jag är ordförande i föreningen som driver butiken'"
                      className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium min-h-[100px] focus:outline-none focus:border-forest"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={reset}
                      className="flex-1 px-5 py-3 rounded-pill border border-cream-warm font-bold text-espresso-light hover:border-espresso-light"
                    >
                      Avbryt
                    </button>
                    <button
                      type="submit"
                      disabled={request.isPending}
                      className="flex-1 bg-forest text-parchment px-5 py-3 rounded-pill font-bold disabled:opacity-50 hover:bg-forest-light transition-colors"
                    >
                      {request.isPending ? 'Skickar…' : 'Skicka förfrågan'}
                    </button>
                  </div>
                  {request.isError && (
                    <p className="text-error text-sm">{labelFor(request.error)}</p>
                  )}
                </form>
              </>
            )}

            {done && (
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-forest text-parchment grid place-items-center text-2xl font-bold">
                  ✓
                </div>
                <h3 className="font-display text-2xl font-medium tracking-tight mb-3">
                  Tack!
                </h3>
                <p className="text-espresso-light mb-6">
                  Vi granskar din förfrågan och hör av oss på <strong>{email}</strong> inom
                  ett dygn. Om allt stämmer får du en länk dit så kan du börja redigera sidan.
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="bg-forest text-parchment px-6 py-3 rounded-pill font-bold hover:bg-forest-light transition-colors"
                >
                  Stäng
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
