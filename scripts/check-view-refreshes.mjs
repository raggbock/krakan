#!/usr/bin/env node
/**
 * check-view-refreshes.mjs
 *
 * Migrations that ALTER a table also need to refresh any view defined as
 * `SELECT t.*` over that table — Postgres freezes the view's column list
 * at creation time, so columns added later don't auto-project. We learned
 * this when slug landed in flea_markets but visible_flea_markets kept
 * returning the pre-slug shape, breaking /loppis/[slug].
 *
 * This script scans supabase/migrations/*.sql and fails if any migration
 * touches a table with dependent views without also refreshing each view
 * in the same file.
 *
 * Run: node scripts/check-view-refreshes.mjs
 *
 * To register a new dependency, add it to TABLE_VIEWS below.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..')
const migrationsDir = join(repoRoot, 'supabase', 'migrations')

/**
 * Map of base tables to views that select * over them. When a migration
 * runs `alter table <key>`, it must also `create or replace view <value>`
 * (one entry per dependent view) so column changes propagate.
 *
 * Add a new entry whenever you create a `select <table>.*` view.
 */
const TABLE_VIEWS = {
  flea_markets: ['visible_flea_markets'],
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

// Pre-pass: per view, find the highest-numbered migration that refreshes it.
// Earlier migrations that altered the underlying table are "absorbed" by
// that refresh — drift is already healed in DB — so we shouldn't keep
// flagging them on every push. Only migrations LATER than the refresh need
// to handle their own column additions.
const lastRefreshIndex = new Map() // view -> file index
for (const view of Object.values(TABLE_VIEWS).flat()) {
  const refreshRe = new RegExp(
    `create\\s+or\\s+replace\\s+view\\s+(public\\.)?${view}\\b`,
    'i',
  )
  files.forEach((file, idx) => {
    const src = readFileSync(join(migrationsDir, file), 'utf8').toLowerCase()
    if (refreshRe.test(src)) lastRefreshIndex.set(view, idx)
  })
}

let violations = 0

files.forEach((file, idx) => {
  const full = join(migrationsDir, file)
  const src = readFileSync(full, 'utf8').toLowerCase()
  const rel = relative(repoRoot, full).replace(/\\/g, '/')

  for (const [table, views] of Object.entries(TABLE_VIEWS)) {
    // Match column-shape changes that risk view drift. INSERT/UPDATE/DELETE
    // don't change shape, so they're fine — only DDL is policed.
    const altersTable = new RegExp(
      `alter\\s+table\\s+(public\\.)?${table}\\b[\\s\\S]*?(add|drop|alter)\\s+column`,
      'i',
    ).test(src)
    if (!altersTable) continue

    for (const view of views) {
      // Skip migrations covered by a later refresh — that newer migration
      // re-expanded the view against the schema-of-the-day, so historical
      // drift is healed and there's nothing to fix here.
      const lastRefresh = lastRefreshIndex.get(view) ?? -1
      if (idx < lastRefresh) continue

      // Same-file refresh is the only signal we accept for current/future
      // migrations. A later separate migration would in theory work too,
      // but we want the check to flag drift at the moment it's introduced.
      const refreshes = new RegExp(
        `create\\s+or\\s+replace\\s+view\\s+(public\\.)?${view}\\b`,
        'i',
      ).test(src)
      if (!refreshes) {
        console.error(
          `MISSING VIEW REFRESH  ${rel}\n` +
            `  Migration alters ${table} but does not refresh dependent view ${view}.\n` +
            `  Append:  CREATE OR REPLACE VIEW public.${view} AS SELECT fm.* FROM ...\n` +
            `  (Use the original definition — see migration that first created the view.)\n`,
        )
        violations++
      }
    }
  }
})

if (violations > 0) {
  console.error(`\ncheck-view-refreshes: ${violations} violation(s) found. Aborting.`)
  process.exit(1)
} else {
  console.log(`check-view-refreshes: all migrations OK (${files.length} scanned).`)
}
