import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createEdgeClient } from './edge'

function makeSupabase(overrides: {
  getSession?: () => Promise<unknown>
  invoke?: (name: string, options: unknown) => Promise<{ data: unknown; error: unknown }>
}) {
  return {
    auth: {
      getSession: overrides.getSession
        ?? (() => Promise.resolve({ data: { session: { access_token: 'token-abc' } } })),
    },
    functions: {
      invoke: overrides.invoke ?? (() => Promise.resolve({ data: null, error: null })),
    },
  } as unknown as SupabaseClient
}

function makeFunctionsHttpError(response: Response) {
  return {
    name: 'FunctionsHttpError',
    message: 'Edge Function returned a non-2xx status code',
    context: response,
  }
}

describe('createEdgeClient', () => {
  it('happy path — attaches Bearer header and returns data', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true, id: 42 }, error: null })
    const supabase = makeSupabase({ invoke })
    const client = createEdgeClient(supabase)

    const result = await client.invoke<{ ok: boolean; id: number }>('some-fn', { foo: 'bar' })

    expect(result).toEqual({ ok: true, id: 42 })
    expect(invoke).toHaveBeenCalledWith('some-fn', {
      headers: { Authorization: 'Bearer token-abc' },
      body: { foo: 'bar' },
    })
  })

  it('omits body when none provided', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null })
    const supabase = makeSupabase({ invoke })
    const client = createEdgeClient(supabase)

    await client.invoke('no-body-fn')

    expect(invoke).toHaveBeenCalledWith('no-body-fn', {
      headers: { Authorization: 'Bearer token-abc' },
    })
  })

  it('throws "Not authenticated" when session is null', async () => {
    const supabase = makeSupabase({
      getSession: () => Promise.resolve({ data: { session: null } }),
    })
    const client = createEdgeClient(supabase)

    await expect(client.invoke('foo')).rejects.toThrow('Not authenticated')
  })

  it('throws "Not authenticated" when session has no access_token', async () => {
    const supabase = makeSupabase({
      getSession: () => Promise.resolve({ data: { session: { access_token: null } } }),
    })
    const client = createEdgeClient(supabase)

    await expect(client.invoke('foo')).rejects.toThrow('Not authenticated')
  })

  it('rejects when invoke returns a plain error without context', async () => {
    const invokeErr = new Error('Boom from edge function')
    const invoke = vi.fn().mockResolvedValue({ data: null, error: invokeErr })
    const supabase = makeSupabase({ invoke })
    const client = createEdgeClient(supabase)

    await expect(client.invoke('bad-fn')).rejects.toBe(invokeErr)
  })

  it('propagates thrown network errors from invoke', async () => {
    const invoke = vi.fn().mockRejectedValue(new Error('Network request failed'))
    const supabase = makeSupabase({ invoke })
    const client = createEdgeClient(supabase)

    await expect(client.invoke('net-fn')).rejects.toThrow('Network request failed')
  })
})

describe('createEdgeClient — invokePublic unwrapEdgeError', () => {
  it('unwraps structured { error } body — token_expired', async () => {
    const rawErr = makeFunctionsHttpError(
      new Response(JSON.stringify({ error: 'token_expired' }), { status: 410 }),
    )
    const invoke = vi.fn().mockResolvedValue({ data: null, error: rawErr })
    const supabase = makeSupabase({ invoke })
    const client = createEdgeClient(supabase)

    const rejection = await client.invokePublic('takeover').catch((e: unknown) => e)
    expect(rejection).toBeInstanceOf(Error)
    expect((rejection as Error).message).toBe('token_expired')
    expect((rejection as Error & { cause: unknown }).cause).toBe(rawErr)
  })

  it('unwraps structured { error } body — Internal error (500)', async () => {
    const rawErr = makeFunctionsHttpError(
      new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 }),
    )
    const invoke = vi.fn().mockResolvedValue({ data: null, error: rawErr })
    const supabase = makeSupabase({ invoke })
    const client = createEdgeClient(supabase)

    await expect(client.invokePublic('some-fn')).rejects.toThrow('Internal error')
  })

  it('re-throws original error when body is not JSON', async () => {
    const rawErr = makeFunctionsHttpError(
      new Response('not json', { status: 500 }),
    )
    const invoke = vi.fn().mockResolvedValue({ data: null, error: rawErr })
    const supabase = makeSupabase({ invoke })
    const client = createEdgeClient(supabase)

    await expect(client.invokePublic('some-fn')).rejects.toBe(rawErr)
  })

  it('re-throws original error when context is undefined (network error)', async () => {
    const rawErr = { name: 'FunctionsFetchError', message: 'network', context: undefined }
    const invoke = vi.fn().mockResolvedValue({ data: null, error: rawErr })
    const supabase = makeSupabase({ invoke })
    const client = createEdgeClient(supabase)

    await expect(client.invokePublic('some-fn')).rejects.toBe(rawErr)
  })

  it('resolves with data when no error', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null })
    const supabase = makeSupabase({ invoke })
    const client = createEdgeClient(supabase)

    const result = await client.invokePublic<{ ok: boolean }>('some-fn')
    expect(result).toEqual({ ok: true })
  })
})
