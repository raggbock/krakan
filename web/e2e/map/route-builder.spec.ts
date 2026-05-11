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
    await expect(page.getByText('Kungsportsavenyn Loppis')).toBeVisible()
    await expect(page.getByText('Linnéstaden Loppis')).toBeVisible()
    await expect(page.locator('input').first()).toHaveValue('Söndagsrundan')
  })

  test('empty draft leaves an empty stop list', async ({ page, seedMarkets, setNow }) => {
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')
    await page.goto('/rundor/skapa')

    await expect(page.getByRole('heading', { name: /Skapa loppisrunda/i })).toBeVisible()
    // No stop names should have leaked from a previous test's localStorage.
    await expect(page.getByText('Kungsportsavenyn Loppis')).not.toBeVisible()
  })
})
