#!/usr/bin/env node
/**
 * check-edge-imports.mjs
 *
 * Scans supabase/functions/**\/*.ts for imports from @fyndstigen/shared/<subpath>
 * and fails if any import is not on the allow-list.
 *
 * Run:  node scripts/check-edge-imports.mjs
 *
 * To add a new allowed subpath, append to ALLOWED_SUBPATHS below and
 * update the comment explaining why it is edge-safe.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..');
const functionsDir = join(repoRoot, 'supabase', 'functions');

/**
 * Subpaths of @fyndstigen/shared that are allowed in edge functions.
 * Each entry is the string that follows "@fyndstigen/shared/" in an import.
 *
 * Rules for adding entries:
 *  - Pure domain logic with no browser/Node globals → OK
 *  - Zod schemas / contracts → OK
 *  - Adapters that only use Deno-compatible APIs → OK
 *  - Anything that pulls in Next.js, React, or Node built-ins → NOT OK
 *
 * If this list grows past ~10 entries, consider migrating to approach (a):
 * a curated packages/shared/edge/ subdir (see issue #40).
 */
const ALLOWED_SUBPATHS = new Set([
  'booking',                                       // pure commission/outcome logic
  'booking-lifecycle',                             // pure event-sourced reducer
  'contracts/booking-create',                      // zod schema
  'contracts/booking-update',                      // zod schema
  'contracts/organizer-stats',                     // zod schema
  'contracts/stripe-connect-create',               // zod schema
  'contracts/stripe-connect-refresh',              // zod schema
  'contracts/stripe-connect-status',               // zod schema
  'contracts/stripe-payment-cancel',               // zod schema
  'contracts/stripe-payment-capture',              // zod schema
  'errors',                                        // AppError + error codes
  'adapters/supabase/booking-repo',                // Supabase DB adapter
  'adapters/stripe/booking-stripe-gateway',        // Stripe adapter
]);

/** Regex that matches any @fyndstigen/shared import */
const IMPORT_RE = /from\s+['"]@fyndstigen\/shared\/([^'"]+)['"]/g;

/** Recursively collect .ts files, skipping _shared helper dir */
function collectTs(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectTs(full));
    } else if (entry.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

const files = collectTs(functionsDir);
let violations = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, idx) => {
    let match;
    // Reset lastIndex for each line
    IMPORT_RE.lastIndex = 0;
    while ((match = IMPORT_RE.exec(line)) !== null) {
      const subpath = match[1];
      if (!ALLOWED_SUBPATHS.has(subpath)) {
        const rel = relative(repoRoot, file).replace(/\\/g, '/');
        console.error(
          `DISALLOWED EDGE IMPORT  ${rel}:${idx + 1}\n` +
          `  "@fyndstigen/shared/${subpath}" is not on the allow-list.\n` +
          `  Add it to ALLOWED_SUBPATHS in scripts/check-edge-imports.mjs` +
          ` if it is edge-safe, or refactor the edge function.\n`
        );
        violations++;
      }
    }
  });
}

if (violations > 0) {
  console.error(`\ncheck-edge-imports: ${violations} violation(s) found. Aborting.`);
  process.exit(1);
} else {
  console.log(`check-edge-imports: all imports OK (${files.length} files scanned).`);
}
