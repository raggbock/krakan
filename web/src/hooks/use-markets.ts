'use client'

import { useEffect, useState } from 'react'
import { api, FleaMarket } from '@/lib/api'

export function useMarkets(params?: { page?: number; pageSize?: number }) {
  const [markets, setMarkets] = useState<FleaMarket[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.fleaMarkets
      .list(params)
      .then((res) => {
        setMarkets(res.items)
        setCount(res.count)
      })
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false))
  }, [params?.page, params?.pageSize])

  return { markets, count, loading }
}

export function useMarketsByOrganizer(organizerId: string | undefined) {
  const [markets, setMarkets] = useState<FleaMarket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizerId) return
    api.fleaMarkets
      .listByOrganizer(organizerId)
      .then(setMarkets)
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false))
  }, [organizerId])

  return { markets, loading }
}
