'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { makeSupabaseDeps } from '@fyndstigen/shared/deps-factory'
import { supabase } from '@/lib/supabase'
import { DepsProvider } from './deps-provider'

// Construct Deps once at module scope so the reference is stable across renders.
// This mirrors how `supabase` itself is constructed — one instance per app.
const appDeps = makeSupabaseDeps(supabase)

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 min before refetch
            retry: 1,
          },
        },
      }),
  )

  return (
    <DepsProvider deps={appDeps}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </DepsProvider>
  )
}
