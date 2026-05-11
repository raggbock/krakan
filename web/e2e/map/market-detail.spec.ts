import { test, expect } from '../helpers/test'
import { gothenburgMarkets } from '../fixtures/markets'

test.use({ permissions: [] })

// Slug-as-id E2E shortcut — /loppis/[slug] renders MarketDetail directly
// under NEXT_PUBLIC_E2E_FAKE without needing a Supabase resolve, so we
// treat the fixture id as the slug for navigation purposes.
const seedWithSlugs = gothenburgMarkets.map((m) => ({ ...m, slug: m.id }))

test.describe('/loppis/[slug] — market detail', () => {
  test('renders the seeded market: name, type stamp, address', async ({ page, seedMarkets, setNow }) => {
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')
    await page.goto('/loppis/m1')

    await expect(page.getByRole('heading', { name: 'Kungsportsavenyn Loppis', level: 1 })).toBeVisible()
    await expect(page.getByText('Permanent')).toBeVisible()
    await expect(page.getByText('Kungsportsavenyn 1')).toBeVisible()
    await expect(page.getByText(/Göteborg/)).toBeVisible()
  })

  test('legacy /fleamarkets/[id] route also renders detail under E2E', async ({ page, seedMarkets, setNow }) => {
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')
    await page.goto('/fleamarkets/m2')

    await expect(page.getByRole('heading', { name: 'Haga Loppis', level: 1 })).toBeVisible()
  })
})
