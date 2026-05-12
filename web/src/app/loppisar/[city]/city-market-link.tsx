'use client'

import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import type { ReactNode } from 'react'

type Props = {
  href: string
  marketId: string
  marketSlug: string | null
  citySlug: string
  position: number
  children: ReactNode
}

export function CityMarketLink({ href, marketId, marketSlug, citySlug, position, children }: Props) {
  const posthog = usePostHog()
  return (
    <Link
      href={href}
      className="vintage-card flex items-center gap-4 p-4 hover:bg-cream-warm/30 transition-colors"
      onClick={() => posthog?.capture('search_result_clicked', {
        source: 'city',
        market_id: marketId,
        market_slug: marketSlug,
        position,
        query: null,
        city_slug: citySlug,
      })}
    >
      {children}
    </Link>
  )
}
