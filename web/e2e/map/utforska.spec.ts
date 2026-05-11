import { test, expect } from '../helpers/test'
import { gothenburgMarkets } from '../fixtures/markets'

// Deny geolocation so /utforska falls back to the regular list adapter.
// The nearby RPC path takes a different code branch (not covered here).
test.use({ permissions: [] })

test.describe('/utforska — discover markets', () => {
  test('renders seeded markets with links to canonical detail pages', async ({ page, seedMarkets, setNow }) => {
    await seedMarkets(gothenburgMarkets.map((m) => ({ ...m, slug: `slug-${m.id}` })))
    await setNow('2026-04-23T12:00:00Z')
    await page.goto('/utforska')

    // List adapter results render as cards — assert two distinct markets are visible.
    await expect(page.getByRole('heading', { name: 'Kungsportsavenyn Loppis' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Haga Loppis' })).toBeVisible()

    // Slug-based URL is the canonical href — the legacy /fleamarkets/[id]
    // route 308-redirects to /loppis/[slug] server-side. Assert href, not
    // post-click URL (SSR redirect needs real Supabase).
    const link = page.getByRole('link', { name: /Kungsportsavenyn Loppis/i }).first()
    await expect(link).toHaveAttribute('href', '/loppis/slug-m1')
  })

  test('shows empty state when no markets are seeded', async ({ page, setNow }) => {
    await setNow('2026-04-23T12:00:00Z')
    await page.goto('/utforska')

    // The page shouldn't crash, and there should be no market cards rendered.
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Kungsportsavenyn|Haga/i })).toHaveCount(0)
  })
})
