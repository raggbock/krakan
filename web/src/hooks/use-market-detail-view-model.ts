'use client'

import { useMemo } from 'react'
import type {
  FleaMarketDetails,
  FleaMarketImage,
  MarketTable,
  OpeningHourRuleView,
  OpeningHourExceptionView,
} from '@fyndstigen/shared'
import { useAuth } from '@/lib/auth/auth-context'
import { marketEditUrl } from '@/lib/urls'
import { useMarketDetails } from './use-market-details'

export type MarketDetailViewModel = {
  market: FleaMarketDetails | null
  tables: MarketTable[]
  /** Sorted by sort_order ascending. Empty array if the market has no images. */
  images: FleaMarketImage[]
  /** Undefined when the market has neither rules nor exceptions. */
  openingHours: { rules: OpeningHourRuleView[]; exceptions: OpeningHourExceptionView[] } | undefined
  isOwner: boolean
  editUrl: string
  /**
   * Map deep-link. Always defined; falls back to `/map` when the market has
   * no coordinates so the UI can render one Link in either case.
   */
  mapUrl: string
  isLoading: boolean
  error: string | null
}

export function useMarketDetailViewModel(id: string): MarketDetailViewModel {
  const { user } = useAuth()
  const { market, tables, loading, error } = useMarketDetails(id)

  return useMemo<MarketDetailViewModel>(() => {
    const images = [...(market?.flea_market_images ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    )

    const rules: OpeningHourRuleView[] = (market?.opening_hour_rules ?? []).map((r) => ({
      id: r.id,
      type: r.type,
      dayOfWeek: r.day_of_week,
      anchorDate: r.anchor_date,
      openTime: r.open_time,
      closeTime: r.close_time,
    }))
    const exceptions: OpeningHourExceptionView[] = market?.opening_hour_exceptions ?? []
    const openingHours =
      rules.length === 0 && exceptions.length === 0
        ? undefined
        : { rules, exceptions }

    const isOwner = !!market && user?.id === market.organizer_id

    const mapUrl = (() => {
      if (!market || market.latitude == null || market.longitude == null) {
        return '/map'
      }
      const params = new URLSearchParams({
        lat: String(market.latitude),
        lng: String(market.longitude),
        name: market.name,
      })
      if (market.slug) params.set('slug', market.slug)
      return `/map?${params.toString()}`
    })()

    return {
      market,
      tables,
      images,
      openingHours,
      isOwner,
      editUrl: marketEditUrl({ id }),
      mapUrl,
      isLoading: loading,
      error,
    }
  }, [market, tables, loading, error, user?.id, id])
}
