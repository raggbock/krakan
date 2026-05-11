import { test, expect } from '../helpers/test'
import { gothenburgMarkets } from '../fixtures/markets'

test.use({ permissions: [] })

const seedWithSlugs = gothenburgMarkets.map((m) => ({ ...m, slug: m.id }))

test.describe('/map — public map page', () => {
  test('renders the map shell and seeded market count', async ({ page, seedMarkets, setNow }) => {
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')
    await page.goto('/map')

    // Map header is the first stable thing we can assert on — the leaflet
    // tile load isn't deterministic across CI runners.
    await expect(page.getByRole('heading', { name: 'Karta' })).toBeVisible()

    // The header sub-text reports "<N> loppisar … i närheten" once the
    // nearby query resolves. With 5 seeded markets within the Gothenburg
    // cluster (and a national 2000km radius) we should land on 5.
    await expect(page.getByText(/5 loppisar/)).toBeVisible({ timeout: 10_000 })
  })
})
