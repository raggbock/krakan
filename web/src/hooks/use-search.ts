'use client'

import { useState, useCallback, useRef } from 'react'
import { api, FleaMarket } from '@/lib/api'

export function useSearch(debounceMs = 300) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FleaMarket[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const search = useCallback(
    (q: string) => {
      setQuery(q)
      clearTimeout(timerRef.current)

      if (!q.trim()) {
        setResults(null)
        setLoading(false)
        setError(null)
        return
      }

      setLoading(true)
      setError(null)
      timerRef.current = setTimeout(async () => {
        try {
          const data = await api.search.query(q)
          setResults(data.fleaMarkets)
        } catch {
          setResults([])
          setError('Sökningen misslyckades')
        } finally {
          setLoading(false)
        }
      }, debounceMs)
    },
    [debounceMs],
  )

  return { query, results, loading, error, search }
}
