'use client'

import { createContext, useContext, useRef } from 'react'
import type { Deps } from '@fyndstigen/shared'

const DepsContext = createContext<Deps | null>(null)

export function DepsProvider({
  deps,
  children,
}: {
  deps: Deps
  children: React.ReactNode
}) {
  // deps is expected to be stable (constructed once at app bootstrap).
  // We wrap in a ref so that even if a parent re-renders and re-creates the
  // Deps object reference, the context value stays the same object.
  const stableRef = useRef<Deps>(deps)

  return (
    <DepsContext.Provider value={stableRef.current}>
      {children}
    </DepsContext.Provider>
  )
}

export function useDeps(): Deps {
  const ctx = useContext(DepsContext)
  if (!ctx) {
    throw new Error('useDeps() must be called inside <DepsProvider>')
  }
  return ctx
}
