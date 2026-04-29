'use client'

import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDeps } from '@/providers/deps-provider'
import type { FleaMarket } from '@fyndstigen/shared'

export function useSearch(debounceMs = 300) {
  const { search } = useDeps()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  function search_(q: string) {
    setQuery(q)
    clearTimeout(timerRef.current)
    if (!q.trim()) {
      setDebouncedQuery('')
      return
    }
    timerRef.current = setTimeout(() => setDebouncedQuery(q), debounceMs)
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => search.query(debouncedQuery),
    enabled: !!debouncedQuery.trim(),
    staleTime: 60_000,
  })

  const results: FleaMarket[] | null = debouncedQuery
    ? (data?.fleaMarkets ?? [])
    : null

  return {
    query,
    results,
    loading: isLoading && !!debouncedQuery,
    error: error ? 'Sökningen misslyckades' : null,
    search: search_,
  }
}
