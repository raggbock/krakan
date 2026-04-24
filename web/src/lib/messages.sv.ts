/**
 * Compatibility shim — re-exports from the canonical shared catalog.
 *
 * This file exists solely because `web/src/hooks/market-form/use-submit-market.ts`
 * imports `messageFor` from here and that file is post-#33 canonical (untouchable).
 * All message logic now lives in `@fyndstigen/shared`.
 *
 * Do NOT add new entries here. Consumers outside market-form/ should import
 * directly from `@fyndstigen/shared`.
 */
export { messageFor } from '@fyndstigen/shared'
