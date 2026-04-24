import type { E2EControl } from '@fyndstigen/shared/deps-factory'
import type { StoredMarket } from '@fyndstigen/shared/adapters/in-memory/flea-markets'

export type E2EBridge = {
  seed: (markets: StoredMarket[]) => void
  reset: () => void
  setNow: (iso: string) => void
}

declare global {
  interface Window {
    __E2E__?: E2EBridge
    __E2E_NOW__?: string
  }
}

/**
 * Attaches a seed/reset/setNow API to the given target (typically `window`)
 * so Playwright tests can preload in-memory deps before navigation.
 *
 * Exists only under NEXT_PUBLIC_E2E_FAKE=1.
 */
export function createE2EBridge(control: E2EControl, target: Window): E2EBridge {
  const bridge: E2EBridge = {
    seed(markets) {
      control.markets.seed(markets)
    },
    reset() {
      control.markets.reset()
      target.__E2E_NOW__ = undefined
    },
    setNow(iso) {
      target.__E2E_NOW__ = iso
    },
  }
  target.__E2E__ = bridge
  return bridge
}
