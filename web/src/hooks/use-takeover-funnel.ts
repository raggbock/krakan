'use client'

import { useQuery } from '@tanstack/react-query'
import { endpoints } from '@/lib/edge'

export function useTakeoverFunnel() {
  return useQuery({
    queryKey: ['admin', 'takeover-funnel'],
    queryFn: () => endpoints['admin.takeover.funnel'].invoke({}),
  })
}
