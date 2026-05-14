import { test, expect } from '../helpers/test'
import { gothenburgMarkets } from '../fixtures/markets'

test.use({ permissions: [] })

const seedWithSlugs = gothenburgMarkets.map((m) => ({ ...m, slug: m.id }))

/**
 * Seeds a route draft into localStorage before navigation so the
 * route-builder's draft-restore picks it up after `useMarketsQuery` resolves
 * (which uses the in-memory `deps.geo.nearbyMarkets`).
 */
async function seedDraft(
  page: import('@playwright/test').Page,
  draft: {
    name: string
    plannedDate: string
    useGps: boolean
    customStart: { lat: number; lng: number } | null
    stops: Array<{ marketId: string; index: number }>
    savedAt: string
  },
) {
  await page.addInitScript((d) => {
    window.localStorage.setItem('fyndstigen.route-draft.v1', JSON.stringify(d))
  }, draft)
}

test.describe('/rundor/skapa — route-builder', () => {
  test('restores draft stops and renders them in the sidebar', async ({ page, seedMarkets, setNow }) => {
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')
    await seedDraft(page, {
      name: 'Söndagsrundan',
      plannedDate: '2026-06-01',
      useGps: true,
      customStart: null,
      stops: [
        { marketId: 'm1', index: 0 },
        { marketId: 'm3', index: 1 },
      ],
      savedAt: new Date().toISOString(),
    })

    await page.goto('/rundor/skapa')

    await expect(page.getByRole('heading', { name: /Skapa loppisrunda/i })).toBeVisible()

    // The draft restore fires once `useMarketsQuery` resolves — both seeded
    // stops should appear in the stop list (and form fields hydrate too).
    // Scope to the stop-list region so we don't false-match the same market
    // names in the "Loppisar nära dig" picker that now sits in the sidebar.
    const stopList = page.getByRole('region', { name: /^Stopp/ })
    await expect(stopList.getByText('Kungsportsavenyn Loppis')).toBeVisible()
    await expect(stopList.getByText('Linnéstaden Loppis')).toBeVisible()
    await expect(page.locator('input').first()).toHaveValue('Söndagsrundan')
  })

  test('"Ta bort stopp" removes the stop from the list and the persisted draft', async ({ page, seedMarkets, setNow }) => {
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')
    await seedDraft(page, {
      name: 'Söndagsrundan',
      plannedDate: '',
      useGps: true,
      customStart: null,
      stops: [
        { marketId: 'm1', index: 0 },
        { marketId: 'm3', index: 1 },
      ],
      savedAt: new Date().toISOString(),
    })

    await page.goto('/rundor/skapa')
    const stopList = page.getByRole('region', { name: /^Stopp/ })
    await expect(stopList.getByText('Kungsportsavenyn Loppis')).toBeVisible()
    await expect(stopList.getByText('Linnéstaden Loppis')).toBeVisible()

    // Two remove buttons (one per stop) — click the first.
    await stopList.getByRole('button', { name: 'Ta bort stopp' }).first().click()

    await expect(stopList.getByText('Kungsportsavenyn Loppis')).not.toBeVisible()
    await expect(stopList.getByText('Linnéstaden Loppis')).toBeVisible()

    // Debounced persist (250ms) — wait for the draft to be rewritten.
    await expect.poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('fyndstigen.route-draft.v1'))
      return raw ? (JSON.parse(raw).stops as Array<{ marketId: string }>).map((s) => s.marketId) : null
    }).toEqual(['m3'])
  })

  test('"Optimera rutt" reorders stops via the in-memory geo adapter', async ({ page, seedMarkets, setNow }) => {
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')
    // Seed two stops; the in-memory optimizeStops calls the same
    // nearest-neighbor route optimizer the prod adapter uses. With
    // useGps=false and no customStart, the first stop is the anchor —
    // the reorder is deterministic but we don't care about the order, only
    // that the button is enabled and clickable, and the stops stay in the list.
    await seedDraft(page, {
      name: 'Test',
      plannedDate: '',
      useGps: false,
      customStart: null,
      stops: [
        { marketId: 'm1', index: 0 },
        { marketId: 'm5', index: 1 }, // Partille — geographically furthest
        { marketId: 'm2', index: 2 }, // Haga — closer to m1
      ],
      savedAt: new Date().toISOString(),
    })

    await page.goto('/rundor/skapa')
    const optimizeBtn = page.getByRole('button', { name: /Optimera rutt/i })
    await expect(optimizeBtn).toBeVisible()
    await optimizeBtn.click()

    // All three stops still present after optimize — no markets dropped.
    const stopList = page.getByRole('region', { name: /^Stopp/ })
    await expect(stopList.getByText('Kungsportsavenyn Loppis')).toBeVisible()
    await expect(stopList.getByText('Haga Loppis')).toBeVisible()
    await expect(stopList.getByText('Partille Loppis')).toBeVisible()
  })

  test('empty draft leaves an empty stop list', async ({ page, seedMarkets, setNow }) => {
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')
    await page.goto('/rundor/skapa')

    await expect(page.getByRole('heading', { name: /Skapa loppisrunda/i })).toBeVisible()
    // No stop names should have leaked from a previous test's localStorage.
    const stopList = page.getByRole('region', { name: /^Stopp/ })
    await expect(stopList.getByText('Kungsportsavenyn Loppis')).not.toBeVisible()
  })
})
