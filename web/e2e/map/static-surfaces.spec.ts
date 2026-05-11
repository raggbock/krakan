import { test, expect } from '../helpers/test'

test.use({ permissions: [] })

test.describe('/rundor — route discovery list', () => {
  test('shows empty-state when no routes are seeded', async ({ page }) => {
    await page.goto('/rundor')

    await expect(page.getByRole('heading', { name: 'Loppisrundor', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Inga rundor publicerade ännu/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Skapa din första runda/i })).toHaveAttribute(
      'href',
      '/rundor/skapa',
    )
  })
})

test.describe('/skapa — anonymous quick-create form', () => {
  test('renders the form with required fields and the helper copy', async ({ page }) => {
    await page.goto('/skapa')

    await expect(page.getByRole('heading', { name: /Skapa er loppis-sida/i, level: 1 })).toBeVisible()
    await expect(page.getByText(/Tar 30 sekunder/i)).toBeVisible()

    // Required input slots — checked via their placeholders to avoid relying
    // on label association (the inputs aren't aria-labelled to their labels).
    await expect(page.getByPlaceholder('T.ex. Vårloppis i Brevik')).toBeVisible()
    await expect(page.getByPlaceholder('Örebro')).toBeVisible()
    await expect(page.getByPlaceholder('T.ex. Storgatan 12')).toBeVisible()
    await expect(page.getByPlaceholder('du@exempel.se')).toBeVisible()
  })
})

test.describe('Cookie consent banner', () => {
  test('Acceptera dismisses the banner and persists across reloads', async ({ page }) => {
    await page.goto('/')

    const banner = page.getByText(/Vi använder cookies för att förbättra/i)
    await expect(banner).toBeVisible()

    await page.getByRole('button', { name: 'Acceptera' }).click()
    await expect(banner).not.toBeVisible()

    await page.reload()
    await expect(page.getByText(/Vi använder cookies för att förbättra/i)).not.toBeVisible()
  })

  test('"Bara nödvändiga" also dismisses the banner', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Bara nödvändiga/i }).click()
    await expect(page.getByText(/Vi använder cookies för att förbättra/i)).not.toBeVisible()
  })
})
