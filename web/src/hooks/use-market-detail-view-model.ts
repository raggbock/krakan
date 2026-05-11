'use client'

import { useMemo } from 'react'
import type {
  FleaMarketDetailsView,
  FleaMarketImageView,
  MarketTableView,
  OpeningHourRuleView,
  OpeningHourExceptionView,
} from '@fyndstigen/shared'
import { useAuth } from '@/lib/auth/auth-context'
import { marketEditUrl } from '@/lib/urls'
import { useMarketDetails } from './use-market-details'

export type MarketDetailViewModel = {
  market: FleaMarketDetailsView | null
  tables: MarketTableView[]
  /** Sorted by sortOrder ascending. Empty array if the market has no images. */
  images: FleaMarketImageView[]
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
    // images are already FleaMarketImageView from the View type — just sort by sortOrder
    const images: FleaMarketImageView[] = [...(market?.images ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)

    const rules: OpeningHourRuleView[] = market?.openingHourRules ?? []
    const exceptions: OpeningHourExceptionView[] = market?.openingHourExceptions ?? []
    const openingHours =
      rules.length === 0 && exceptions.length === 0
        ? undefined
        : { rules, exceptions }

    const isOwner = !!market && user?.id === market.organizerId

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
