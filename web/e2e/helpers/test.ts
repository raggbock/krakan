import { test as base, expect } from '@playwright/test'
import type { StoredMarket } from '@fyndstigen/shared/adapters/in-memory/flea-markets'
import { installOsrmFixtures } from './osrm'

type MapFixtures = {
  seedMarkets: (markets: StoredMarket[]) => Promise<void>
  setNow: (iso: string) => Promise<void>
}

/**
 * Shared Playwright test. The map profile uses `seedMarkets` and `setNow`
 * to stage `window.__E2E_PRE_SEED__` / `window.__E2E_NOW__` via
 * `addInitScript` BEFORE any navigation — so the bridge can drain them
 * on attach and the first React Query fetch sees data. OSRM requests are
 * auto-intercepted on every page.
 *
 * IMPORTANT: call `seedMarkets`/`setNow` BEFORE the first `page.goto(...)`.
 * They persist across full reloads in the same test.
 */
export const test = base.extend<MapFixtures>({
  page: async ({ page }, use) => {
    await installOsrmFixtures(page)
    await use(page)
  },
  seedMarkets: async ({ page }, use) => {
    await use(async (markets) => {
      await page.addInitScript((m) => {
        ;(window as unknown as { __E2E_PRE_SEED__: unknown }).__E2E_PRE_SEED__ = m
      }, markets as unknown as unknown[])
    })
  },
  setNow: async ({ page }, use) => {
    await use(async (iso) => {
      await page.addInitScript((i) => {
        ;(window as unknown as { __E2E_NOW__: string }).__E2E_NOW__ = i
      }, iso)
    })
  },
})

export { expect }
