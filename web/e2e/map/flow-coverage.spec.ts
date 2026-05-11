import { test, expect } from '../helpers/test'
import { gothenburgMarkets } from '../fixtures/markets'

test.use({ permissions: [] })

const seedWithSlugs = gothenburgMarkets.map((m) => ({ ...m, slug: m.id }))

test.describe('Global nav', () => {
  test('nav links route to their canonical paths', async ({ page }) => {
    await page.goto('/')

    // Scope to the page <nav> so we don't collide with mobile-menu duplicates.
    const nav = page.getByRole('navigation').first()
    await expect(nav.getByRole('link', { name: 'Utforska' })).toHaveAttribute('href', '/utforska')
    await expect(nav.getByRole('link', { name: 'Sök' })).toHaveAttribute('href', '/search')
    await expect(nav.getByRole('link', { name: 'Karta' })).toHaveAttribute('href', '/map')
    await expect(nav.getByRole('link', { name: 'Rundor' })).toHaveAttribute('href', '/rundor')

    await nav.getByRole('link', { name: 'Utforska' }).click()
    await expect(page).toHaveURL(/\/utforska$/)
  })
})

test.describe('/profile — auth gate', () => {
  test('redirects logged-out visitors to /auth', async ({ page }) => {
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/auth(\?.*)?$/, { timeout: 5000 })
  })
})

test.describe('Cookie consent — reopen via footer', () => {
  test('"Cookie-inställningar" reopens the banner after a prior choice', async ({ page }) => {
    await page.goto('/')
    // Use the decline path — "Acceptera" hard-reloads the page, which races
    // with the reopen-event listener and makes the test flaky.
    await page.getByRole('button', { name: /Bara nödvändiga/i }).click()
    await expect(page.getByText(/Vi använder cookies/i)).not.toBeVisible()

    await page.getByRole('button', { name: /Cookie-inställningar/i }).click()
    await expect(page.getByText(/Vi använder cookies/i)).toBeVisible()
  })
})

test.describe('Market detail — not-found branch', () => {
  test('a slug with no seeded market renders the "Loppisen hittades inte" copy', async ({ page, seedMarkets, setNow }) => {
    // Seed a different market so the deps are wired but the queried slug
    // resolves to an empty details() call client-side.
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')
    await page.goto('/loppis/this-slug-does-not-exist')

    await expect(page.getByRole('heading', { name: /Loppisen hittades inte/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Tillbaka till utforska/i })).toHaveAttribute('href', '/utforska')
  })
})

test.describe('/rundor/skapa/tack — anonymous save thank-you', () => {
  test('renders the success copy and reflects the email from the query string', async ({ page }) => {
    await page.goto('/rundor/skapa/tack?email=test%40example.com')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('test@example.com')).toBeVisible()
  })

  test('falls back to "din e-post" when no email param is present', async ({ page }) => {
    await page.goto('/rundor/skapa/tack')
    await expect(page.getByText(/din e-post/)).toBeVisible()
  })
})
