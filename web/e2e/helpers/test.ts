import { test as base, expect } from '@playwright/test'
import type { StoredMarket } from '@fyndstigen/shared/adapters/in-memory/flea-markets'
import { installOsrmFixtures } from './osrm'

type MapFixtures = {
  seedMarkets: (markets: StoredMarket[]) => Promise<void>
  setNow: (iso: string) => Promise<void>
}

/**
 * Shared Playwright test. The map profile uses `seedMarkets` and `setNow`
 * to prime `window.__E2E__` after navigation; OSRM requests are auto-
 * intercepted on every page. Smoke tests that don't need these fixtures
 * still work — the `page` override only adds the OSRM handler, which is
 * a no-op unless the code under test calls out to OSRM.
 */
export const test = base.extend<MapFixtures>({
  page: async ({ page }, use) => {
    await installOsrmFixtures(page)
    await use(page)
  },
  seedMarkets: async ({ page }, use) => {
    await use(async (markets) => {
      await page.waitForFunction(() => !!window.__E2E__)
      await page.evaluate((m) => {
        window.__E2E__!.seed(m as unknown as Parameters<NonNullable<typeof window.__E2E__>['seed']>[0])
      }, markets as unknown as unknown[])
    })
  },
  setNow: async ({ page }, use) => {
    await use(async (iso) => {
      await page.waitForFunction(() => !!window.__E2E__)
      await page.evaluate((i) => {
        window.__E2E__!.setNow(i)
      }, iso)
    })
  },
})

export { expect }
