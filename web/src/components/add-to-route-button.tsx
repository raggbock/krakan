'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { addStopToDraft, isMarketInDraft } from '@/hooks/route-builder/draft'

type Source = 'market_detail' | 'explore_card'

type Props = {
  marketId: string
  /** For telemetry; not displayed to the user. */
  marketName?: string
  marketCity?: string
  source: Source
  /** Compact card-corner variant used on explore listings. */
  compact?: boolean
}

/**
 * "Lägg till i rundan" — surfaces the route-builder draft from anywhere a
 * market is shown (#139). Reads/writes the same localStorage key as the
 * route-builder so opening /rundor/skapa picks the markets up via the
 * existing draft-restore path in useDraftPersistence.
 *
 * State is hydrated from localStorage on mount and refreshed on tab focus
 * so opening this page in two tabs stays consistent.
 */
export function AddToRouteButton({
  marketId,
  marketName,
  marketCity,
  source,
  compact = false,
}: Props) {
  const posthog = usePostHog()
  const [inRoute, setInRoute] = useState(false)
  const [justAdded, setJustAdded] = useState(false)
  const [stopCount, setStopCount] = useState(0)

  // Hydrate on mount + refresh on focus so multi-tab state stays right.
  useEffect(() => {
    function refresh() {
      if (typeof window === 'undefined') return
      setInRoute(isMarketInDraft(window.localStorage, marketId))
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [marketId])

  // Auto-dismiss the inline confirmation after 4 s.
  useEffect(() => {
    if (!justAdded) return
    const timer = setTimeout(() => setJustAdded(false), 4000)
    return () => clearTimeout(timer)
  }, [justAdded])

  function handleClick(e: React.MouseEvent) {
    // The compact variant is rendered inside a card-level <Link>; stop the
    // click from bubbling so adding to the route doesn't also navigate to
    // the market-detail page.
    e.preventDefault()
    e.stopPropagation()
    if (typeof window === 'undefined') return
    if (inRoute) return // Click on "✓ I rundan" is a no-op; user uses the link below to navigate.

    const { draft, added } = addStopToDraft(window.localStorage, marketId)
    if (!added) return // race-condition guard — shouldn't happen given inRoute check above

    setInRoute(true)
    setJustAdded(true)
    setStopCount(draft.stops.length)
    posthog?.capture('route_market_added_from_detail', {
      market_id: marketId,
      market_name: marketName,
      market_city: marketCity,
      source,
      stop_count_after: draft.stops.length,
    })
  }

  const compactBase =
    'inline-flex items-center justify-center w-9 h-9 rounded-full text-white shadow-sm transition-colors'
  const fullBase =
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors shadow-sm'

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={inRoute ? 'Redan i rundan' : 'Lägg till i rundan'}
        aria-pressed={inRoute}
        className={`${compactBase} ${
          inRoute
            ? 'bg-forest hover:bg-forest-light'
            : 'bg-rust hover:bg-rust-light'
        }`}
      >
        {inRoute ? '✓' : '+'}
      </button>
    )
  }

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={inRoute}
        className={`${fullBase} ${
          inRoute
            ? 'bg-forest text-white hover:bg-forest-light cursor-default'
            : 'bg-rust text-white hover:bg-rust-light'
        }`}
      >
        {inRoute ? (
          <>
            <span aria-hidden>✓</span> I rundan
          </>
        ) : (
          <>
            <span aria-hidden className="text-base leading-none">+</span> Lägg till i rundan
          </>
        )}
      </button>

      {justAdded && (
        <div
          role="status"
          aria-live="polite"
          className="text-xs text-espresso/70 animate-fade-up"
        >
          {stopCount === 1
            ? <>Rundan började — <Link href="/rundor/skapa" className="text-rust font-semibold underline">Visa rundan →</Link></>
            : <>Tillagd. Du har {stopCount} stopp — <Link href="/rundor/skapa" className="text-rust font-semibold underline">Visa rundan →</Link></>
          }
        </div>
      )}
    </div>
  )
}
