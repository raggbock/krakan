'use client'

import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { FleaMarket } from '@/lib/api'
import { useDeps } from '@/providers/deps-provider'

export function useSearch(debounceMs = 300) {
  const { search: searchRepo } = useDeps()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  function search(q: string) {
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
    queryFn: () => searchRepo.query(debouncedQuery),
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
    search,
  }
}
