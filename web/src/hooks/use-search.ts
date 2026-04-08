'use client'

import { useState, useCallback, useRef } from 'react'
import { api, FleaMarket } from '@/lib/api'

export function useSearch(debounceMs = 300) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FleaMarket[] | null>(null)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const search = useCallback(
    (q: string) => {
      setQuery(q)
      clearTimeout(timerRef.current)

      if (!q.trim()) {
        setResults(null)
        setLoading(false)
        return
      }

      setLoading(true)
      timerRef.current = setTimeout(async () => {
        try {
          const data = await api.search.query(q)
          setResults(data.fleaMarkets)
        } catch {
          setResults([])
        } finally {
          setLoading(false)
        }
      }, debounceMs)
    },
    [debounceMs],
  )

  return { query, results, loading, search }
}
