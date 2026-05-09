#!/usr/bin/env node
/**
 * check-view-refreshes.mjs
 *
 * Migrations that ALTER a table also need to refresh any view defined as
 * `SELECT <alias>.*` over that table — Postgres freezes the view's column
 * list at creation time, so columns added later don't auto-project. We
 * learned this when slug landed in flea_markets but visible_flea_markets
 * kept returning the pre-slug shape, breaking /loppis/[slug].
 *
 * This script auto-discovers wildcard views from migrations: any
 * `CREATE [OR REPLACE] VIEW v AS SELECT t.*` (or `SELECT *`) gets registered
 * and policed. Explicit-column views are exempt — only wildcard views drift.
 *
 * The latest definition of each view wins. If a view is later redefined to
 * use explicit columns, it drops out of the policed set automatically.
 *
 * Run: node scripts/check-view-refreshes.mjs
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..')
const migrationsDir = join(repoRoot, 'supabase', 'migrations')

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

/**
 * Auto-discover wildcard views.
 *
 * Pattern matches:
 *   create [or replace] view [public.]<view> [with (...)] as
 *     select <alias>.* from [public.]<table> <alias> ...
 *
 * Or the unaliased form:
 *     select * from [public.]<table> ...
 *
 * Returns a map of base-table → Set of dependent views.
 */
function discoverWildcardViews() {
  const viewLatestKind = new Map() // view -> { kind: 'wildcard' | 'explicit', table?: string }

  const viewRe =
    /create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?(\w+)\b[\s\S]*?\bas\b([\s\S]*?);/gi

  for (const file of files) {
    const src = readFileSync(join(migrationsDir, file), 'utf8').toLowerCase()
    viewRe.lastIndex = 0
    let match
    while ((match = viewRe.exec(src)) !== null) {
      const view = match[1]
      const body = match[2]

      const aliasedWildcard = body.match(
        /select\s+(\w+)\.\*[\s\S]*?from\s+(?:public\.)?(\w+)\s+\1\b/i,
      )
      const bareWildcard = body.match(/select\s+\*\s+from\s+(?:public\.)?(\w+)\b/i)

      if (aliasedWildcard) {
        viewLatestKind.set(view, { kind: 'wildcard', table: aliasedWildcard[2] })
      } else if (bareWildcard) {
        viewLatestKind.set(view, { kind: 'wildcard', table: bareWildcard[1] })
      } else {
        viewLatestKind.set(view, { kind: 'explicit' })
      }
    }
  }

  const tableViews = new Map() // table -> Set<view>
  for (const [view, info] of viewLatestKind) {
    if (info.kind !== 'wildcard' || !info.table) continue
    if (!tableViews.has(info.table)) tableViews.set(info.table, new Set())
    tableViews.get(info.table).add(view)
  }
  return tableViews
}

const TABLE_VIEWS = discoverWildcardViews()

if (TABLE_VIEWS.size === 0) {
  console.log('check-view-refreshes: no wildcard views found.')
  process.exit(0)
}

const lastRefreshIndex = new Map() // view -> file index
for (const views of TABLE_VIEWS.values()) {
  for (const view of views) {
    const refreshRe = new RegExp(
      `create\\s+(or\\s+replace\\s+)?view\\s+(public\\.)?${view}\\b`,
      'i',
    )
    files.forEach((file, idx) => {
      const src = readFileSync(join(migrationsDir, file), 'utf8').toLowerCase()
      if (refreshRe.test(src)) lastRefreshIndex.set(view, idx)
    })
  }
}

let violations = 0

files.forEach((file, idx) => {
  const full = join(migrationsDir, file)
  const src = readFileSync(full, 'utf8').toLowerCase()
  const rel = relative(repoRoot, full).replace(/\\/g, '/')

  for (const [table, views] of TABLE_VIEWS) {
    const altersTable = new RegExp(
      `alter\\s+table\\s+(public\\.)?${table}\\b[\\s\\S]*?(add|drop|alter)\\s+column`,
      'i',
    ).test(src)
    if (!altersTable) continue

    for (const view of views) {
      const lastRefresh = lastRefreshIndex.get(view) ?? -1
      if (idx < lastRefresh) continue

      const refreshes = new RegExp(
        `create\\s+(or\\s+replace\\s+)?view\\s+(public\\.)?${view}\\b`,
        'i',
      ).test(src)
      if (!refreshes) {
        console.error(
          `MISSING VIEW REFRESH  ${rel}\n` +
            `  Migration alters ${table} but does not refresh dependent view ${view}.\n` +
            `  Append:  CREATE OR REPLACE VIEW public.${view} AS SELECT t.* FROM ...\n` +
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
  const summary = Array.from(TABLE_VIEWS.entries())
    .map(([t, vs]) => `${t} -> ${[...vs].join(',')}`)
    .join('; ')
  console.log(
    `check-view-refreshes: all migrations OK (${files.length} scanned). Tracked: ${summary}.`,
  )
}
