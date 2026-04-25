'use client'

import { useQuery } from '@tanstack/react-query'
import { useDeps } from '@/providers/deps-provider'

/**
 * Visible market ids that are currently open according to weekly/biweekly
 * opening_hour_rules (Stockholm local clock). Backed by the
 * markets_open_now() Postgres function.
 *
 * Stale time: 60s — opening windows rarely flip mid-minute, but we want
 * boundaries (e.g. shop closes at 17:00) to be picked up reasonably fast.
 */
export function useOpenNowIds(enabled = true) {
  const { markets } = useDeps()
  return useQuery({
    queryKey: ['markets', 'open-now'],
    queryFn: () => markets.openNowIds(),
    enabled,
    staleTime: 60 * 1000,
  })
}
