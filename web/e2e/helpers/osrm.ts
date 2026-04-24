import type { Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Playwright compiles this file to CommonJS, so __dirname works here.
const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'osrm')

// Must match the hash logic in record-osrm-fixtures.mjs exactly — both
// produce the same sha1-prefix given the same coord string.
function hashCoords(coords: string): string {
  return createHash('sha1').update(coords).digest('hex').slice(0, 16)
}

function coordsFromUrl(url: string): string {
  const seg = url.split('/driving/')[1]
  if (!seg) return ''
  return seg.split('?')[0]
}

/**
 * Intercepts requests to the public OSRM routing server and serves a
 * recorded JSON fixture instead. Missing fixtures fail loudly with the
 * exact recording command so they never silently drift from the coords
 * a test actually requests.
 */
export async function installOsrmFixtures(page: Page): Promise<void> {
  await page.route('**/router.project-osrm.org/**', async (route) => {
    const url = route.request().url()
    const coords = coordsFromUrl(url)
    const key = hashCoords(coords)
    const fixturePath = join(FIXTURE_DIR, `${key}.json`)
    if (!existsSync(fixturePath)) {
      throw new Error(
        `OSRM fixture missing for coords="${coords}" (key=${key}). ` +
          `Run \`npm run e2e:fixtures -- "${coords}"\` to record it.`,
      )
    }
    const body = readFileSync(fixturePath, 'utf-8')
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
}
