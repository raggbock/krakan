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
