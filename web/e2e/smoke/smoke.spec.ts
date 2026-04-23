import { expect, test } from '../helpers/test'

test.describe('Public-page smoke', () => {
  test('landing renders hero and primary CTA', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /varje stig leder/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /utforska loppisar/i }).first()).toBeVisible()
  })

  test('primary CTA navigates to /utforska', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /utforska loppisar/i }).first().click()
    await expect(page).toHaveURL(/\/utforska$/)
  })

  test('footer exposes cookie settings on first visit', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /cookie-inställningar/i })).toBeVisible()
  })

  test('/fragor-svar renders FAQ heading', async ({ page }) => {
    await page.goto('/fragor-svar')
    await expect(
      page.getByRole('heading', { name: /frågor/i, level: 1 }),
    ).toBeVisible()
  })

  test('/integritetspolicy renders policy heading', async ({ page }) => {
    await page.goto('/integritetspolicy')
    await expect(
      page.getByRole('heading', { name: /integritetspolicy/i, level: 1 }),
    ).toBeVisible()
  })
})

test.describe('Auth form', () => {
  test('renders sign-in form with autofocused email', async ({ page }) => {
    await page.goto('/auth')
    const email = page.getByLabel(/e-post/i)
    await expect(email).toBeVisible()
    await expect(email).toBeFocused()
  })

  test('toggle to sign-up changes the submit label', async ({ page }) => {
    await page.goto('/auth')
    await page.getByRole('button', { name: 'Skapa konto' }).first().click()
    await expect(page.getByRole('button', { name: 'Skapa konto' }).last()).toBeEnabled()
    await expect(page.getByRole('heading', { name: /skapa konto/i })).toBeVisible()
  })

  test('forgot-password link reveals reset form', async ({ page }) => {
    await page.goto('/auth')
    await page.getByRole('button', { name: /glömt lösenord/i }).click()
    await expect(page.getByRole('heading', { name: /återställ/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /skicka återställningslänk/i })).toBeVisible()
  })

  test('preserves ?next= param on the URL for post-login redirect', async ({ page }) => {
    await page.goto('/auth?next=/profile')
    // The redirect only triggers on successful auth, but the page should
    // still render the form with the URL param intact.
    await expect(page).toHaveURL(/\?next=%2Fprofile|\?next=\/profile/)
    await expect(page.getByLabel(/e-post/i)).toBeVisible()
  })
})
