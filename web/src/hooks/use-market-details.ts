'use client'

import { useEffect, useState } from 'react'
import { api, FleaMarketDetails, MarketTable } from '@/lib/api'

export function useMarketDetails(id: string | undefined) {
  const [market, setMarket] = useState<FleaMarketDetails | null>(null)
  const [tables, setTables] = useState<MarketTable[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.fleaMarkets.details(id),
      api.marketTables.list(id),
    ])
      .then(([m, t]) => {
        setMarket(m)
        setTables(t)
      })
      .catch(() => setMarket(null))
      .finally(() => setLoading(false))
  }, [id])

  return { market, tables, loading }
}
