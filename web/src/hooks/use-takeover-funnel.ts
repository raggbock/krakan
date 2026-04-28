'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useTakeoverFunnel() {
  return useQuery({
    queryKey: ['admin', 'takeover-funnel'],
    queryFn: () => api.endpoints['admin.takeover.funnel'].invoke({}),
  })
}
