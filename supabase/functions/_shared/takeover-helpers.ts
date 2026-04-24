/**
 * Shared helpers for the takeover edge functions. Pure utilities — no
 * runtime side effects beyond crypto.
 */

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 6-digit numeric code, zero-padded. Uses rejection sampling so the
 *  distribution is exactly uniform across 000000-999999 (plain modulo
 *  biases the lower ~97% of values). */
export function generateCode(): string {
  const buf = new Uint32Array(1)
  const maxMultiple = Math.floor(0xFFFFFFFF / 1_000_000) * 1_000_000
  do {
    crypto.getRandomValues(buf)
  } while (buf[0] >= maxMultiple)
  return (buf[0] % 1_000_000).toString().padStart(6, '0')
}

/** Constant-time string comparison (length-insensitive — both inputs are
 * hex SHA-256 hashes of the same length). */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export const CODE_TTL_MS = 15 * 60 * 1000 // 15 min
export const MAX_CODE_ATTEMPTS = 5
