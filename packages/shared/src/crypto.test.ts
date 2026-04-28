import { describe, it, expect } from 'vitest'
import { sha256Hex, generateCode, timingSafeEqualHex } from './crypto'

// ---------------------------------------------------------------------------
// sha256Hex
// ---------------------------------------------------------------------------

describe('sha256Hex', () => {
  it('returns a 64-character lowercase hex string', async () => {
    const result = await sha256Hex('hello')
    expect(result).toHaveLength(64)
    expect(result).toMatch(/^[0-9a-f]{64}$/)
  })

  it('matches a known SHA-256 value', async () => {
    // Canonical test vector from NIST FIPS 180-4: SHA-256("abc")
    const result = await sha256Hex('abc')
    expect(result).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('matches the well-known SHA-256 of the empty string', async () => {
    const result = await sha256Hex('')
    expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('produces different hashes for different inputs', async () => {
    const a = await sha256Hex('foo')
    const b = await sha256Hex('bar')
    expect(a).not.toBe(b)
  })

  it('is deterministic — same input always same output', async () => {
    const input = 'deterministic-test-value'
    const a = await sha256Hex(input)
    const b = await sha256Hex(input)
    expect(a).toBe(b)
  })
})

// ---------------------------------------------------------------------------
// timingSafeEqualHex
// ---------------------------------------------------------------------------

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

  it('works correctly on 64-char hex hashes', async () => {
    const hash = await sha256Hex('test-token')
    expect(timingSafeEqualHex(hash, hash)).toBe(true)
    const other = await sha256Hex('different-token')
    expect(timingSafeEqualHex(hash, other)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// generateCode
// ---------------------------------------------------------------------------

describe('generateCode', () => {
  it('always returns a 6-digit zero-padded string (production rng)', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateCode()
      expect(code).toMatch(/^\d{6}$/)
      expect(code.length).toBe(6)
    }
  })

  it('produces values across the full 000000-999999 range', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 5000; i++) codes.add(generateCode())
    // Smoke check that we see variety — not a distribution test.
    expect(codes.size).toBeGreaterThan(4500)
  })

  it('pads small numbers with leading zeros (fixed seed via rng)', () => {
    // Force rng to produce a number that % 1_000_000 = 42.
    const rng = () => 42 / 0xffffffff
    expect(generateCode(rng)).toBe('000042')
  })

  it('always returns a 6-digit zero-padded string (custom rng)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode(Math.random)
      expect(code).toMatch(/^\d{6}$/)
    }
  })
})
