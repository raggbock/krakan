#!/usr/bin/env node
/**
 * Record a smooth video of the route-builder demo for social media.
 *
 * Usage:
 *   node scripts/record-route-demo.mjs                 # mobile portrait 390x844
 *   node scripts/record-route-demo.mjs --square        # 1080x1080
 *   node scripts/record-route-demo.mjs --landscape     # 1280x720
 *
 * Requires the dev server running on http://localhost:3000.
 * Output: ./demo-output/fyndstigen-skapa-rutt.mp4 (and .webm)
 */
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import { mkdirSync, renameSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const args = process.argv.slice(2)
const SIZE = args.includes('--square')
  ? { width: 1080, height: 1080 }
  : args.includes('--landscape')
  ? { width: 1280, height: 720 }
  : { width: 390, height: 844 }

const OUT_DIR = resolve('demo-output')
const TMP_DIR = join(OUT_DIR, 'tmp')
const URL = 'http://localhost:3000/rundor/skapa'

// Playwright's bundled ffmpeg
const FFMPEG = join(
  process.env.LOCALAPPDATA ?? join(process.env.HOME ?? '', 'AppData', 'Local'),
  'ms-playwright',
  'ffmpeg-1011',
  'ffmpeg-win64.exe',
)

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function run() {
  rmSync(TMP_DIR, { recursive: true, force: true })
  mkdirSync(TMP_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 2,
    recordVideo: { dir: TMP_DIR, size: SIZE },
  })
  const page = await context.newPage()

  // Clear state before navigating
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })

  // Dismiss cookie banner if present
  const cookieBtn = page.getByRole('button', { name: /Bara nödvändiga/i })
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click()
  }

  // Wait for map + markers
  await page.waitForSelector('.leaflet-marker-icon', { timeout: 15000 })
  await sleep(1500)

  // --- DEMO STARTS — everything below is recorded smoothly at ~25fps ---

  // Pause on intro
  await sleep(1200)

  // Click 3 markers. Leaflet pans the map when a popup opens, so positions
  // shift between clicks — re-measure each time and skip markers already
  // in the route (their popup says "Ta bort").
  async function visibleMarkers() {
    return page.evaluate(() => {
      const map = document.querySelector('.leaflet-container')
      if (!map) return []
      const mb = map.getBoundingClientRect()
      const seen = new Set()
      const pts = []
      for (const el of document.querySelectorAll('.leaflet-marker-icon')) {
        // Skip markers already in the route — their icon has a number badge.
        const src = el.getAttribute('src') ?? ''
        const isInRoute = src.includes('%3Ctext') || decodeURIComponent(src).includes('<text')
        if (isInRoute) continue
        const r = el.getBoundingClientRect()
        const x = r.left + r.width / 2
        const y = r.top + r.height / 2
        if (x < mb.left + 5 || x > mb.right - 5) continue
        if (y < mb.top + 5 || y > mb.bottom - 5) continue
        const key = `${Math.round(x / 10)},${Math.round(y / 10)}`
        if (seen.has(key)) continue
        seen.add(key)
        pts.push({ x, y })
      }
      return pts
    })
  }

  async function currentStopCount() {
    return page.evaluate(() => {
      const h = Array.from(document.querySelectorAll('h2')).find((x) =>
        x.textContent?.includes('Stopp'),
      )
      const m = h?.textContent?.match(/\((\d+)\)/)
      return m ? Number(m[1]) : 0
    })
  }

  // Click 3 markers. Leaflet auto-pans on popup open which shifts marker
  // positions — close any open popup before re-measuring.
  for (let i = 0; i < 3; i++) {
    // Close any open popup first so subsequent clicks reach the markers
    await page.evaluate(() => document.querySelector('.leaflet-popup-close-button')?.click())
    await sleep(500)

    const markers = await visibleMarkers()
    if (markers.length === 0) break
    const map = await page.locator('.leaflet-container').boundingBox()
    const cx = map.x + map.width / 2
    const cy = map.y + map.height / 2
    // Pick farthest from center for later clicks to spread the route out
    const target = markers
      .map((p) => ({ p, d: Math.hypot(p.x - cx, p.y - cy) }))
      .sort((a, b) => (i === 0 ? a.d - b.d : b.d - a.d))[0]?.p
    if (!target) break
    await page.mouse.click(target.x, target.y)
    await sleep(1100)
    console.log(`Click ${i + 1} → Stopp (${await currentStopCount()})`)
  }
  await page.evaluate(() => document.querySelector('.leaflet-popup-close-button')?.click())
  await sleep(400)
  // Close the last popup before scrolling/typing
  const closeBtn = page.locator('.leaflet-popup-close-button').first()
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click()
    await sleep(400)
  }

  await sleep(800)

  // Type name into the route name field
  const nameField = page.getByPlaceholder(/Söndagsrundan|Namn|Helgrundan/i).first()
  await nameField.click()
  await sleep(300)
  // type slowly so user sees the keystrokes
  await nameField.type('Helgens loppisrunda', { delay: 60 })

  await sleep(800)

  // Scroll Optimera rutt into view and click it
  const optimera = page.getByRole('button', { name: /Optimera rutt/i })
  await optimera.scrollIntoViewIfNeeded()
  await sleep(600)
  await optimera.click()

  // Hold on the result so viewers can read the new order
  await sleep(2500)

  // --- DEMO ENDS ---

  await context.close()
  await browser.close()

  // Locate the saved webm
  const webms = readdirSync(TMP_DIR).filter((f) => f.endsWith('.webm'))
  if (webms.length === 0) throw new Error('No video captured')
  const webm = join(TMP_DIR, webms[0])
  const finalWebm = join(OUT_DIR, 'fyndstigen-skapa-rutt.webm')
  renameSync(webm, finalWebm)
  console.log('Saved', finalWebm)

  // Note: Playwright's bundled ffmpeg is stripped to webm/vp8 only.
  // To convert to MP4 (better for Instagram/TikTok), install ffmpeg system-wide:
  //   choco install ffmpeg   or   scoop install ffmpeg
  // Then: ffmpeg -i fyndstigen-skapa-rutt.webm -c:v libx264 -crf 20 -pix_fmt yuv420p fyndstigen-skapa-rutt.mp4
  console.log('\nTip: convert to MP4 with system ffmpeg:')
  console.log(`  ffmpeg -i "${finalWebm}" -c:v libx264 -crf 20 -pix_fmt yuv420p fyndstigen-skapa-rutt.mp4`)

  rmSync(TMP_DIR, { recursive: true, force: true })
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
