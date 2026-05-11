import { test, expect } from '../helpers/test'

test.use({ permissions: [] })

// Smoke-level coverage for routes whose layouts previously did blocking
// server-side Supabase calls. The bypass under NEXT_PUBLIC_E2E_FAKE skips
// the resolve so the client tree mounts; we don't seed deps here so the
// hooks land in their "not found" / error state — that itself proves the
// layout no longer 500s and the client component reached its data branch.

test.describe('SSR bypass — dynamic detail routes', () => {
  test('/arrangorer/[id] renders the not-found branch when organizer unseeded', async ({ page }) => {
    await page.goto('/arrangorer/nonexistent')
    await expect(page.getByRole('heading', { name: /Arrangören hittades inte/i })).toBeVisible()
  })

  test('/kvartersloppis/[slug] renders the error branch when slug unseeded', async ({ page }) => {
    await page.goto('/kvartersloppis/nonexistent')
    await expect(page.getByText(/Kunde inte ladda kvartersloppis|Laddar/i)).toBeVisible()
  })
})
