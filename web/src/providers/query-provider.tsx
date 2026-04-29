'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import type { Deps } from '@fyndstigen/shared'
import {
  makeSupabaseDeps,
  createE2EInMemoryDeps,
} from '@fyndstigen/shared/deps-factory'
import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/compress-image'
import { DepsProvider } from './deps-provider'
import { createE2EBridge } from '@/lib/e2e/bridge'

const isE2EFake = process.env.NEXT_PUBLIC_E2E_FAKE === '1'

function buildAppDeps(): Deps {
  if (isE2EFake) {
    const { deps, control } = createE2EInMemoryDeps()
    if (typeof window !== 'undefined') {
      createE2EBridge(control, window)
    }
    return deps
  }
  return makeSupabaseDeps(supabase, { compressImage })
}

// Construct Deps once at module scope so the reference is stable across renders.
const appDeps = buildAppDeps()

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: isE2EFake ? 0 : 60 * 1000,
            retry: isE2EFake ? 0 : 1,
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
