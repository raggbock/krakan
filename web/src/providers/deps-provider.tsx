/**
 * DepsProvider — React context that publishes the `Deps` container to the
 * component tree.
 *
 * Why at the React root: `Deps` bundles all I/O adapters (DB, images, etc.).
 * Placing it at the root lets every hook call `useDeps()` without prop-drilling
 * and lets E2E tests substitute `createE2EInMemoryDeps()` for the production
 * Supabase adapters by swapping the `deps` prop at the `QueryProvider` level.
 *
 * Stability contract: `deps` must be constructed ONCE (e.g. at module scope in
 * `query-provider.tsx`). Recreating the object on every render triggers
 * unnecessary re-renders in all consumers — that is a caller bug.
 *
 * `useDeps()` throws a programming-error exception if called outside a
 * `<DepsProvider>` — this is intentional (invariant, not user-facing).
 */

'use client'

import { createContext, useContext } from 'react'
import type { Deps } from '@fyndstigen/shared'

const DepsContext = createContext<Deps | null>(null)

/**
 * DepsProvider expects a stable `deps` prop (construct once at app bootstrap).
 * Context identity tracks the prop — if callers re-create the object on every
 * render, consumers will see a new reference; that's a caller bug, not this
 * provider's concern.
 */
export function DepsProvider({
  deps,
  children,
}: {
  deps: Deps
  children: React.ReactNode
}) {
  return <DepsContext.Provider value={deps}>{children}</DepsContext.Provider>
}

export function useDeps(): Deps {
  const ctx = useContext(DepsContext)
  if (!ctx) {
    // eslint-disable-next-line no-restricted-syntax -- programming invariant: hook misuse that should never reach users
    throw new Error('useDeps() must be called inside <DepsProvider>')
  }
  return ctx
}
