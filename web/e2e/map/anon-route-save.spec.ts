import { test, expect } from '../helpers/test'
import { gothenburgMarkets } from '../fixtures/markets'

test.use({ permissions: [] })

const seedWithSlugs = gothenburgMarkets.map((m) => ({ ...m, slug: m.id }))

test.describe('/rundor/skapa — anonymous save panel', () => {
  test('shows email-save form once the draft has stops', async ({ page, seedMarkets, setNow }) => {
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')

    // Pre-seed a draft with one stop so the anon save panel becomes visible
    // (the form only renders when stops.length > 0 + user is not logged in).
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'fyndstigen.route-draft.v1',
        JSON.stringify({
          name: 'Min runda',
          plannedDate: '',
          useGps: true,
          customStart: null,
          stops: [{ marketId: 'm1', index: 0 }],
          savedAt: new Date().toISOString(),
        }),
      )
    })

    await page.goto('/rundor/skapa')

    // Wait for the draft restore to fire (markets must load first). Scope to
    // the stop-list region so we don't double-match the same name in the
    // "Loppisar nära dig" sidebar picker.
    const stopList = page.getByRole('region', { name: /^Stopp/ })
    await expect(stopList.getByText('Kungsportsavenyn Loppis')).toBeVisible()

    // Prompt + form + login fallback link.
    await expect(page.getByText(/Du har 1 stopp på din runda/i)).toBeVisible()
    await expect(page.getByPlaceholder('din@epost.se')).toBeVisible()
    await expect(page.getByRole('button', { name: /Spara via mail/i })).toBeDisabled()

    // Typing an email enables the submit button.
    await page.getByPlaceholder('din@epost.se').fill('test@example.com')
    await expect(page.getByRole('button', { name: /Spara via mail/i })).toBeEnabled()

    // Fallback "logga in" link inside the anon-save panel (lowercase 'l' —
    // the global nav has a separate "Logga in" link with capital L).
    await expect(page.getByRole('link', { name: 'logga in', exact: true })).toHaveAttribute('href', '/auth')
  })

  test('shows the empty-draft prompt when no stops are present', async ({ page, seedMarkets, setNow }) => {
    await seedMarkets(seedWithSlugs)
    await setNow('2026-04-23T12:00:00Z')
    await page.goto('/rundor/skapa')

    // Empty-draft prompt (logged-out): "Logga in för att spara din runda."
    await expect(page.getByText(/Logga in/i).first()).toBeVisible()
    // No anon save form yet.
    await expect(page.getByPlaceholder('din@epost.se')).not.toBeVisible()
  })
})
