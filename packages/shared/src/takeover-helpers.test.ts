import { describe, it, expect } from 'vitest'

/**
 * Mirror of the pure helpers in supabase/functions/_shared/takeover-helpers.ts.
 * Duplicated so the shared test runner can cover them — they can't be
 * imported directly from the Deno function tree without pulling Deno-only
 * globals (crypto.subtle is fine but the module is under /supabase).
 */

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function generateCode(rng: () => number = Math.random): string {
  // Uniform via rejection sampling. We exercise the distribution with
  // a seedable rng so the test isn't flaky.
  const max = 0xFFFFFFFF
  const maxMultiple = Math.floor(max / 1_000_000) * 1_000_000
  let n: number
  do {
    n = Math.floor(rng() * (max + 1))
  } while (n >= maxMultiple)
  return (n % 1_000_000).toString().padStart(6, '0')
}

describe('timingSafeEqualHex', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqualHex('abc123', 'abc123')).toBe(true)
  })

  it('returns false for different strings of equal length', () => {
    expect(timingSafeEqualHex('abc123', 'abc124')).toBe(false)
  })

  it('returns false for different lengths (short-circuit)', () => {
    expect(timingSafeEqualHex('abc', 'abcd')).toBe(false)
  })

  it('returns true for empty strings', () => {
    expect(timingSafeEqualHex('', '')).toBe(true)
  })
})

describe('generateCode', () => {
  it('always returns a 6-digit zero-padded string', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateCode()
      expect(code).toMatch(/^\d{6}$/)
      expect(code.length).toBe(6)
    }
  })

  it('produces values across the full 000000-999999 range', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 5000; i++) codes.add(generateCode())
    // Not a distribution test, just a smoke check that we see variety.
    expect(codes.size).toBeGreaterThan(4500)
  })

  it('pads small numbers with leading zeros (fixed seed)', () => {
    // Force rng to produce a number that % 1_000_000 = 42.
    const rng = () => 42 / 0xFFFFFFFF
    expect(generateCode(rng)).toBe('000042')
  })
})
