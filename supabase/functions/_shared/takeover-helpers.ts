/**
 * Takeover edge-function helpers.
 *
 * The crypto primitives (sha256Hex, generateCode, timingSafeEqualHex) now
 * live in the canonical shared package so they can be tested under Vitest
 * without a Deno runtime. This file re-exports them for backwards-compat
 * with existing edge-function imports and adds the few constants that are
 * only relevant to the takeover flow.
 */
export { sha256Hex, generateCode, timingSafeEqualHex } from '@fyndstigen/shared/crypto.ts'

export const CODE_TTL_MS = 15 * 60 * 1000 // 15 min
export const MAX_CODE_ATTEMPTS = 5
