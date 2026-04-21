import { describe, it, expect, vi } from 'vitest'
import { createImageService } from './images'

// -----------------------------------------------------------------------------
// Minimal in-memory Supabase stub. We only model the surface the ImageService
// actually calls: storage.from(bucket).upload/remove/getPublicUrl, rpc(),
// and from(table).delete().eq(). Not the real SDK, not trying to be.
// -----------------------------------------------------------------------------

type Row = { id: string; storage_path: string; sort_order: number; flea_market_id: string }

type StubOptions = {
  uploadError?: unknown
  rpcError?: unknown
  removeError?: unknown
  deleteError?: unknown
}

function createStubSupabase(opts: StubOptions = {}) {
  const uploads = new Map<string, File>() // path -> file
  const rows: Row[] = []
  const uploadSpy = vi.fn()
  const removeSpy = vi.fn()
  const rpcSpy = vi.fn()
  const deleteSpy = vi.fn()
  const getPublicUrlSpy = vi.fn()

  let nextId = 1

  const client = {
    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string, file: File) => {
          uploadSpy(path, file)
          if (opts.uploadError) return { error: opts.uploadError }
          uploads.set(path, file)
          return { error: null }
        },
        remove: async (paths: string[]) => {
          removeSpy(paths)
          if (opts.removeError) return { error: opts.removeError }
          for (const p of paths) uploads.delete(p)
          return { error: null }
        },
        getPublicUrl: (path: string) => {
          getPublicUrlSpy(path)
          return { data: { publicUrl: `https://cdn.example/${path}` } }
        },
      }),
    },
    rpc: async (name: string, args: { p_flea_market_id: string; p_storage_path: string }) => {
      rpcSpy(name, args)
      if (opts.rpcError) return { data: null, error: opts.rpcError }
      const existing = rows.filter((r) => r.flea_market_id === args.p_flea_market_id)
      const maxOrder = existing.reduce((m, r) => Math.max(m, r.sort_order), -1)
      const row: Row = {
        id: `row-${nextId++}`,
        flea_market_id: args.p_flea_market_id,
        storage_path: args.p_storage_path,
        sort_order: maxOrder + 1,
      }
      rows.push(row)
      return { data: row, error: null }
    },
    from: (_table: string) => ({
      delete: () => ({
        eq: async (_col: string, id: string) => {
          deleteSpy(id)
          if (opts.deleteError) return { error: opts.deleteError }
          const idx = rows.findIndex((r) => r.id === id)
          if (idx >= 0) rows.splice(idx, 1)
          return { error: null }
        },
      }),
    }),
  }

  return {
    // cast — the service only ever calls the methods defined above
    supabase: client as unknown as import('@supabase/supabase-js').SupabaseClient,
    uploads,
    rows,
    spies: { uploadSpy, removeSpy, rpcSpy, deleteSpy, getPublicUrlSpy },
  }
}

function fakeFile(name = 'photo.jpg', size = 100): File {
  // jsdom File works fine; otherwise fall back to a minimal stub.
  try {
    return new File(['x'.repeat(size)], name, { type: 'image/jpeg' })
  } catch {
    return { name, size, type: 'image/jpeg' } as unknown as File
  }
}

describe('createImageService', () => {
  it('happy path: uploads blob and inserts row with computed path and sort_order', async () => {
    const stub = createStubSupabase()
    const svc = createImageService({ supabase: stub.supabase })

    const result = await svc.add('market-1', fakeFile('beach.jpg'))

    expect(result.sort_order).toBe(0)
    expect(result.storage_path).toMatch(/^market-1\/[0-9a-f-]+\.jpg$/)
    expect(stub.spies.uploadSpy).toHaveBeenCalledTimes(1)
    expect(stub.spies.rpcSpy).toHaveBeenCalledWith('insert_flea_market_image', {
      p_flea_market_id: 'market-1',
      p_storage_path: result.storage_path,
    })
    expect(stub.uploads.has(result.storage_path)).toBe(true)
  })

  it('orphan rescue: when INSERT rejects, the uploaded blob is removed', async () => {
    const stub = createStubSupabase({ rpcError: new Error('RLS denied') })
    const svc = createImageService({ supabase: stub.supabase })

    await expect(svc.add('market-1', fakeFile())).rejects.toThrow('RLS denied')

    expect(stub.spies.uploadSpy).toHaveBeenCalledTimes(1)
    const uploadedPath = stub.spies.uploadSpy.mock.calls[0][0]
    expect(stub.spies.removeSpy).toHaveBeenCalledWith([uploadedPath])
  })

  it('sort_order assignment: two sequential adds get 0 then 1 via the RPC', async () => {
    const stub = createStubSupabase()
    const svc = createImageService({ supabase: stub.supabase })

    const first = await svc.add('market-1', fakeFile('a.jpg'))
    const second = await svc.add('market-1', fakeFile('b.jpg'))

    expect(first.sort_order).toBe(0)
    expect(second.sort_order).toBe(1)
    // Both went through the atomic RPC — not a read-then-write.
    expect(stub.spies.rpcSpy).toHaveBeenCalledTimes(2)
    for (const call of stub.spies.rpcSpy.mock.calls) {
      expect(call[0]).toBe('insert_flea_market_image')
    }
  })

  it('compress injection: compress is invoked before upload', async () => {
    const stub = createStubSupabase()
    const compressed = fakeFile('compressed.jpg', 50)
    const compress = vi.fn().mockResolvedValue(compressed)

    const svc = createImageService({ supabase: stub.supabase, compress })

    const source = fakeFile('raw.jpg', 500)
    await svc.add('market-1', source)

    expect(compress).toHaveBeenCalledWith(source)
    // The blob sent to storage is the compressed one, not the original.
    expect(stub.spies.uploadSpy.mock.calls[0][1]).toBe(compressed)
  })

  it('remove(): deletes both the storage blob and the DB row', async () => {
    const stub = createStubSupabase()
    const svc = createImageService({ supabase: stub.supabase })

    const created = await svc.add('market-1', fakeFile())

    await svc.remove(created)

    expect(stub.spies.removeSpy).toHaveBeenCalledWith([created.storage_path])
    expect(stub.spies.deleteSpy).toHaveBeenCalledWith(created.id)
    expect(stub.rows).toHaveLength(0)
    expect(stub.uploads.has(created.storage_path)).toBe(false)
  })

  it('publicUrl: delegates to supabase storage getPublicUrl', () => {
    const stub = createStubSupabase()
    const svc = createImageService({ supabase: stub.supabase })

    const url = svc.publicUrl('market-1/abc.jpg')
    expect(url).toBe('https://cdn.example/market-1/abc.jpg')
    expect(stub.spies.getPublicUrlSpy).toHaveBeenCalledWith('market-1/abc.jpg')
  })
})
