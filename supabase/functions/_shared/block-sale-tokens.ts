/**
 * HMAC-SHA-256 token signing/verification for block-sale stand edit links.
 *
 * Environment variable:
 *   BLOCK_SALE_TOKEN_SECRET — must be set in Supabase function secrets
 *   (supabase secrets set BLOCK_SALE_TOKEN_SECRET=<random-256-bit-hex>)
 *   Falls back to 'dev-secret' locally — never use the fallback in production.
 */

const KEY = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(Deno.env.get('BLOCK_SALE_TOKEN_SECRET') ?? 'dev-secret'),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify'],
)

export async function signEditToken(payload: { standId: string }): Promise<string> {
  const body = btoa(JSON.stringify({ ...payload, iat: Date.now() }))
  const sig = await crypto.subtle.sign('HMAC', KEY, new TextEncoder().encode(body))
  return `${body}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`
}

export async function verifyEditToken(
  token: string,
): Promise<{ standId: string; iat: number } | null> {
  const [body, sigStr] = token.split('.')
  if (!body || !sigStr) return null
  let sig: Uint8Array
  try {
    sig = Uint8Array.from(atob(sigStr), (c) => c.charCodeAt(0))
  } catch {
    return null
  }
  const ok = await crypto.subtle.verify('HMAC', KEY, sig, new TextEncoder().encode(body))
  if (!ok) return null
  try {
    return JSON.parse(atob(body))
  } catch {
    return null
  }
}
