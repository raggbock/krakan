import type { Page } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { coordsFromUrl, hashCoords } from './osrm-hash.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = join(HERE, '..', 'fixtures', 'osrm')

/**
 * Intercepts requests to the public OSRM routing server and serves a
 * recorded JSON fixture instead. Fails the test loudly if a fixture is
 * missing — run `npm run e2e:fixtures -- "<coords>"` to record one.
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
