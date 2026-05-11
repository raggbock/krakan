import { test, expect } from '../helpers/test'
import { gothenburgMarkets } from '../fixtures/markets'

test.use({ permissions: [] })

const seedWithSlugs = gothenburgMarkets.map((m) => ({ ...m, slug: m.id }))

test.describe('/utforska — open-now filter', () => {
  test('toggle activates the chip and reveals the live count', async ({ page, seedMarkets, setNow }) => {
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')
    await page.goto('/utforska')

    const button = page.getByRole('button', { name: /Öppet just nu/i })
    await expect(button).toBeVisible()

    // Inactive style: cream border, no emerald background.
    await expect(button).not.toHaveClass(/bg-emerald-700/)

    await button.click()

    // Active style + sidebar count appears.
    await expect(button).toHaveClass(/bg-emerald-700/)
    await expect(page.getByText(/öppna just nu|Hämtar öppettider/i)).toBeVisible()
  })
})

test.describe('Not-found page', () => {
  test('an unknown route renders the Swedish 404 copy', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')
    await expect(page.getByRole('heading', { name: 'Sidan hittades inte', level: 1 })).toBeVisible()
  })
})

test.describe('/auth/reset-password — invalid token state', () => {
  test('renders the "länken är ogiltig" message when no recovery session is present', async ({ page }) => {
    await page.goto('/auth/reset-password')
    await expect(page.getByText(/Återställningslänken är ogiltig eller har gått ut/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /Begär en ny länk/i })).toHaveAttribute('href', '/auth')
  })
})

test.describe('Market detail "Visa på karta" deep link', () => {
  test('links to /map with the market\'s lat/lng/slug query params', async ({ page, seedMarkets, setNow }) => {
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')
    await page.goto('/loppis/m1')

    const link = page.getByRole('link', { name: /Visa på karta/i })
    await expect(link).toBeVisible()
    const href = await link.getAttribute('href')
    expect(href).toMatch(/\/map\?/)
    expect(href).toContain('lat=57.7015')
    expect(href).toContain('lng=11.9719')
  })
})
