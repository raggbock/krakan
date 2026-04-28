/**
 * Portable crypto utilities.
 *
 * All three helpers rely on the Web Crypto API (`globalThis.crypto`), which
 * is available in:
 *   - Deno (runtime)
 *   - Node 19+ / all modern Node (via globalThis.crypto)
 *   - jsdom test environment used by Vitest (via globalThis.crypto)
 *
 * No Node built-ins, no Deno globals — fully portable.
 */

/**
 * SHA-256 hash of `input` (UTF-8 encoded), returned as a lowercase hex string.
 */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  )
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generate a 6-digit, zero-padded numeric code (000000–999999).
 *
 * Uses rejection sampling to ensure a perfectly uniform distribution —
 * plain modulo would bias the lower ~97 % of values.
 *
 * @param rng - Optional random-number source for deterministic tests.
 *   Called repeatedly and must return a value in [0, 1). Defaults to
 *   `crypto.getRandomValues` sampling.
 */
export function generateCode(rng?: () => number): string {
  const max = 0xffffffff
  const maxMultiple = Math.floor(max / 1_000_000) * 1_000_000

  if (rng) {
    // Test path: use the caller-supplied rng (seedable / deterministic).
    let n: number
    do {
      n = Math.floor(rng() * (max + 1))
    } while (n >= maxMultiple)
    return (n % 1_000_000).toString().padStart(6, '0')
  }

  // Production path: cryptographically secure via rejection sampling.
  const buf = new Uint32Array(1)
  do {
    globalThis.crypto.getRandomValues(buf)
  } while (buf[0] >= maxMultiple)
  return (buf[0] % 1_000_000).toString().padStart(6, '0')
}

/**
 * Constant-time comparison of two hex strings.
 *
 * Length-insensitive short-circuit (different length → false immediately)
 * is acceptable here because both inputs are expected to be hex-encoded
 * SHA-256 hashes of the same fixed length (64 chars). The comparison loop
 * itself is always O(n) for equal-length strings, preventing timing leaks
 * on the content.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
