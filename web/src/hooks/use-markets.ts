'use client'

import { useEffect, useState } from 'react'
import { api, FleaMarket } from '@/lib/api'

export function useMarkets(params?: { page?: number; pageSize?: number }) {
  const [markets, setMarkets] = useState<FleaMarket[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    api.fleaMarkets
      .list(params)
      .then((res) => {
        setMarkets(res.items)
        setCount(res.count)
      })
      .catch(() => setError('Kunde inte ladda loppisar'))
      .finally(() => setLoading(false))
  }, [params?.page, params?.pageSize])

  return { markets, count, loading, error }
}

export function useMarketsByOrganizer(organizerId: string | undefined) {
  const [markets, setMarkets] = useState<FleaMarket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizerId) return
    setError(null)
    api.fleaMarkets
      .listByOrganizer(organizerId)
      .then(setMarkets)
      .catch(() => setError('Kunde inte ladda loppisar'))
      .finally(() => setLoading(false))
  }, [organizerId])

  return { markets, loading, error }
}
