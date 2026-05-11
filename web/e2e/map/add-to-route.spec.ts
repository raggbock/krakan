import { test, expect } from '../helpers/test'
import { gothenburgMarkets } from '../fixtures/markets'

test.use({ permissions: [] })

const seedWithSlugs = gothenburgMarkets.map((m) => ({ ...m, slug: m.id }))

test.describe('Lägg till i rundan (#139)', () => {
  test('adds market to draft from detail page and persists to localStorage', async ({
    page,
    seedMarkets,
    setNow,
  }) => {
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')
    await page.goto('/loppis/m1')

    await expect(page.getByRole('heading', { name: 'Kungsportsavenyn Loppis', level: 1 })).toBeVisible()

    const button = page.getByRole('button', { name: /Lägg till i rundan/i })
    await expect(button).toBeVisible()
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    await button.click()

    await expect(page.getByRole('button', { name: /I rundan/i })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('status')).toContainText(/Rundan började/)
    await expect(page.getByRole('link', { name: /Visa rundan/i })).toHaveAttribute('href', '/rundor/skapa')

    const draft = await page.evaluate(() => localStorage.getItem('fyndstigen.route-draft.v1'))
    expect(draft).not.toBeNull()
    const parsed = JSON.parse(draft as string)
    expect(parsed.stops).toEqual([{ marketId: 'm1', index: 0 }])
  })

  test('reflects existing draft state on reload', async ({ page, seedMarkets, setNow }) => {
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')
    await page.goto('/loppis/m1')

    await page.getByRole('button', { name: /Lägg till i rundan/i }).click()
    await expect(page.getByRole('button', { name: /I rundan/i })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: /I rundan/i })).toBeVisible()
  })

  test('appending a second market grows the draft and updates copy', async ({ page, seedMarkets, setNow }) => {
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')

    await page.goto('/loppis/m1')
    await page.getByRole('button', { name: /Lägg till i rundan/i }).click()

    await page.goto('/loppis/m2')
    await page.getByRole('button', { name: /Lägg till i rundan/i }).click()
    await expect(page.getByRole('status')).toContainText(/Du har 2 stopp/)

    const draft = await page.evaluate(() => localStorage.getItem('fyndstigen.route-draft.v1'))
    const parsed = JSON.parse(draft as string)
    expect(parsed.stops).toHaveLength(2)
    expect(parsed.stops.map((s: { marketId: string }) => s.marketId)).toEqual(['m1', 'm2'])
  })
})
