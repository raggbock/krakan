'use client'

import { useEffect, useRef } from 'react'
import { usePostHog } from 'posthog-js/react'
import { useAuth } from '@/lib/auth-context'

type MarketViewSource = 'direct' | 'list' | 'route' | 'map' | 'takeover' | 'unknown'

function detectSourceFromReferrer(): MarketViewSource {
  const referrer = document.referrer
  if (!referrer) return 'direct'
  try {
    const ref = new URL(referrer)
    // Same host check
    if (ref.host !== window.location.host) return 'direct'
    const path = ref.pathname
    if (path.includes('/loppisar')) return 'list'
    if (path.includes('/rundor')) return 'route'
    if (path.includes('/map')) return 'map'
    return 'unknown'
  } catch {
    return 'direct'
  }
}

export function TrackMarketView({ marketId, slug }: { marketId: string; slug: string }) {
  const posthog = usePostHog()
  const { user } = useAuth()
  const viewFiredRef = useRef<string | null>(null)
  const claimFiredRef = useRef<string | null>(null)

  useEffect(() => {
    // Fire market_viewed at most once per marketId (auth-independent).
    if (viewFiredRef.current !== marketId) {
      viewFiredRef.current = marketId
      const params = new URLSearchParams(window.location.search)
      const fromTakeover = params.get('from') === 'takeover'
      const source: MarketViewSource = fromTakeover ? 'takeover' : detectSourceFromReferrer()
      posthog?.capture('market_viewed', { market_id: marketId, slug, source })
    }

    // Fire takeover_claimed only when we have a logged-in user AND ?from=takeover.
    // Gates against unauthenticated pastes of the URL inflating conversion counts.
    if (claimFiredRef.current !== marketId && user) {
      const params = new URLSearchParams(window.location.search)
      if (params.get('from') === 'takeover') {
        claimFiredRef.current = marketId
        posthog?.capture('takeover_claimed', { market_id: marketId, slug })
        // Strip ?from=takeover so it doesn't leak via Referer to outbound links
        // or pollute $current_url on subsequent events.
        params.delete('from')
        const qs = params.toString()
        const cleanUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
        window.history.replaceState(null, '', cleanUrl)
      }
    }
  }, [marketId, slug, posthog, user])

  return null
}
