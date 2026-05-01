import { assertEquals, assertExists } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { signEditToken, verifyEditToken } from './block-sale-tokens.ts'

// ---------------------------------------------------------------------------
// 1. signEditToken shape
// ---------------------------------------------------------------------------

Deno.test('block-sale-tokens: signEditToken returns body.sig (two segments)', async () => {
  const token = await signEditToken({ standId: 'abc' })
  const parts = token.split('.')
  assertEquals(parts.length, 2)
  // Both segments must be non-empty
  assertExists(parts[0])
  assertExists(parts[1])
  assertEquals(parts[0].length > 0, true)
  assertEquals(parts[1].length > 0, true)
})

// ---------------------------------------------------------------------------
// 2. Round-trip
// ---------------------------------------------------------------------------

Deno.test('block-sale-tokens: round-trip verifyEditToken(signEditToken({standId})) returns standId + iat', async () => {
  const token = await signEditToken({ standId: 'test-stand-id' })
  const payload = await verifyEditToken(token)
  assertExists(payload)
  assertEquals(payload!.standId, 'test-stand-id')
  assertEquals(typeof payload!.iat, 'number')
})

// ---------------------------------------------------------------------------
// 3. Tampered body → null
// ---------------------------------------------------------------------------

Deno.test('block-sale-tokens: tampered body returns null', async () => {
  const token = await signEditToken({ standId: 'xyz' })
  const [body, sig] = token.split('.')
  // Replace first 4 chars of body with 'XXXX'
  const tamperedBody = 'XXXX' + body.slice(4)
  const tamperedToken = `${tamperedBody}.${sig}`
  const result = await verifyEditToken(tamperedToken)
  assertEquals(result, null)
})

// ---------------------------------------------------------------------------
// 4. Tampered signature → null
// ---------------------------------------------------------------------------

Deno.test('block-sale-tokens: tampered signature returns null', async () => {
  const token = await signEditToken({ standId: 'xyz' })
  const [body, sig] = token.split('.')
  // Replace first 4 chars of sig with 'XXXX'
  const tamperedSig = 'XXXX' + sig.slice(4)
  const tamperedToken = `${body}.${tamperedSig}`
  const result = await verifyEditToken(tamperedToken)
  assertEquals(result, null)
})

// ---------------------------------------------------------------------------
// 5–8. Malformed token cases
// ---------------------------------------------------------------------------

Deno.test('block-sale-tokens: no dot (garbage) → null without throw', async () => {
  const result = await verifyEditToken('garbage')
  assertEquals(result, null)
})

Deno.test('block-sale-tokens: empty string → null without throw', async () => {
  const result = await verifyEditToken('')
  assertEquals(result, null)
})

Deno.test('block-sale-tokens: single segment (no dot) → null', async () => {
  const result = await verifyEditToken('onlyone')
  assertEquals(result, null)
})

Deno.test('block-sale-tokens: non-base64 body → null without throw', async () => {
  const result = await verifyEditToken('!@#.!@#')
  assertEquals(result, null)
})
