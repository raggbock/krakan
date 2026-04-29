import { describe, it, expect } from 'vitest'
import {
  TakeoverInfoInput,
  TakeoverInfoOutput,
  TakeoverStartInput,
  TakeoverStartOutput,
  TakeoverVerifyInput,
  TakeoverVerifyOutput,
  TakeoverFeedbackInput,
  TakeoverFeedbackOutput,
  TakeoverRemoveInput,
  TakeoverRemoveOutput,
} from './takeover'

// ── TakeoverInfoInput ────────────────────────────────────────────────────────

describe('TakeoverInfoInput', () => {
  it('accepts a valid token', () => {
    const result = TakeoverInfoInput.safeParse({ token: 'a'.repeat(20) })
    expect(result.success).toBe(true)
  })

  it('rejects token shorter than 20 characters', () => {
    const result = TakeoverInfoInput.safeParse({ token: 'short' })
    expect(result.success).toBe(false)
  })

  it('rejects missing token', () => {
    const result = TakeoverInfoInput.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ── TakeoverInfoOutput ───────────────────────────────────────────────────────

describe('TakeoverInfoOutput', () => {
  it('round-trips a full output', () => {
    const sample = {
      name: 'Loppis Centralen',
      city: 'Stockholm',
      region: 'Stockholms län',
      sourceUrl: 'https://example.com',
      maskedEmail: 'i••@example.com',
      marketId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    }
    const parsed = TakeoverInfoOutput.parse(JSON.parse(JSON.stringify(sample)))
    expect(parsed).toEqual(sample)
  })

  it('accepts null nullable fields', () => {
    const result = TakeoverInfoOutput.safeParse({
      name: 'Loppis',
      city: null,
      region: null,
      sourceUrl: null,
      maskedEmail: null,
      marketId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-uuid marketId', () => {
    const result = TakeoverInfoOutput.safeParse({
      name: 'Loppis',
      city: null,
      region: null,
      sourceUrl: null,
      maskedEmail: null,
      marketId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })
})

// ── TakeoverStartInput ───────────────────────────────────────────────────────

describe('TakeoverStartInput', () => {
  it('accepts valid token and email', () => {
    const result = TakeoverStartInput.safeParse({
      token: 'a'.repeat(20),
      email: 'user@example.com',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = TakeoverStartInput.safeParse({
      token: 'a'.repeat(20),
      email: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('rejects token shorter than 20 characters', () => {
    const result = TakeoverStartInput.safeParse({ token: 'short', email: 'user@example.com' })
    expect(result.success).toBe(false)
  })
})

// ── TakeoverStartOutput ──────────────────────────────────────────────────────

describe('TakeoverStartOutput', () => {
  it('accepts ok=true with magicLinkSent=true', () => {
    const result = TakeoverStartOutput.safeParse({ ok: true, magicLinkSent: true })
    expect(result.success).toBe(true)
  })

  it('accepts ok=true with magicLinkSent=false', () => {
    const result = TakeoverStartOutput.safeParse({ ok: true, magicLinkSent: false })
    expect(result.success).toBe(true)
  })

  it('rejects missing magicLinkSent', () => {
    const result = TakeoverStartOutput.safeParse({ ok: true })
    expect(result.success).toBe(false)
  })
})

// ── TakeoverVerifyInput ──────────────────────────────────────────────────────

describe('TakeoverVerifyInput', () => {
  it('accepts valid token, email, and 6-digit code', () => {
    const result = TakeoverVerifyInput.safeParse({
      token: 'a'.repeat(20),
      email: 'user@example.com',
      code: '123456',
    })
    expect(result.success).toBe(true)
  })

  it('rejects code that is not exactly 6 digits', () => {
    const result = TakeoverVerifyInput.safeParse({
      token: 'a'.repeat(20),
      email: 'user@example.com',
      code: '12345',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-numeric code', () => {
    const result = TakeoverVerifyInput.safeParse({
      token: 'a'.repeat(20),
      email: 'user@example.com',
      code: 'abcdef',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = TakeoverVerifyInput.safeParse({
      token: 'a'.repeat(20),
      email: 'bad',
      code: '123456',
    })
    expect(result.success).toBe(false)
  })
})

// ── TakeoverVerifyOutput ─────────────────────────────────────────────────────

describe('TakeoverVerifyOutput', () => {
  it('round-trips through JSON', () => {
    const sample = { ok: true as const, magicLinkSent: true }
    const parsed = TakeoverVerifyOutput.parse(JSON.parse(JSON.stringify(sample)))
    expect(parsed).toEqual(sample)
  })

  it('rejects missing ok field', () => {
    const result = TakeoverVerifyOutput.safeParse({ magicLinkSent: true })
    expect(result.success).toBe(false)
  })
})

// ── TakeoverFeedbackInput ────────────────────────────────────────────────────

describe('TakeoverFeedbackInput', () => {
  it('accepts valid input', () => {
    const result = TakeoverFeedbackInput.safeParse({
      token: 'a'.repeat(20),
      email: 'user@example.com',
      message: 'Hej, vad kul!',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty message', () => {
    const result = TakeoverFeedbackInput.safeParse({
      token: 'a'.repeat(20),
      email: 'user@example.com',
      message: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects message exceeding 2000 characters', () => {
    const result = TakeoverFeedbackInput.safeParse({
      token: 'a'.repeat(20),
      email: 'user@example.com',
      message: 'x'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })
})

// ── TakeoverFeedbackOutput ───────────────────────────────────────────────────

describe('TakeoverFeedbackOutput', () => {
  it('accepts { ok: true }', () => {
    const result = TakeoverFeedbackOutput.safeParse({ ok: true })
    expect(result.success).toBe(true)
  })

  it('rejects missing ok', () => {
    const result = TakeoverFeedbackOutput.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ── TakeoverRemoveInput ──────────────────────────────────────────────────────

describe('TakeoverRemoveInput', () => {
  it('accepts valid token without reason', () => {
    const result = TakeoverRemoveInput.safeParse({ token: 'a'.repeat(20) })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.reason).toBeUndefined()
  })

  it('accepts valid token with reason present', () => {
    const result = TakeoverRemoveInput.safeParse({
      token: 'a'.repeat(20),
      reason: 'Dubblett',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.reason).toBe('Dubblett')
  })

  it('rejects reason exceeding 2000 characters', () => {
    const result = TakeoverRemoveInput.safeParse({
      token: 'a'.repeat(20),
      reason: 'x'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects token shorter than 20 characters', () => {
    const result = TakeoverRemoveInput.safeParse({ token: 'short' })
    expect(result.success).toBe(false)
  })
})

// ── TakeoverRemoveOutput ─────────────────────────────────────────────────────

describe('TakeoverRemoveOutput', () => {
  it('accepts { ok: true }', () => {
    const result = TakeoverRemoveOutput.safeParse({ ok: true })
    expect(result.success).toBe(true)
  })

  it('rejects { ok: false }', () => {
    const result = TakeoverRemoveOutput.safeParse({ ok: false })
    expect(result.success).toBe(false)
  })
})
