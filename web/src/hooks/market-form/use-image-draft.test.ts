import { renderHook, act } from '@testing-library/react'
import { useImageDraft } from './use-image-draft'
import type { FleaMarketImage } from '@fyndstigen/shared'

// jsdom doesn't implement createObjectURL
global.URL.createObjectURL = vi.fn((f: File) => `blob:${f.name}`)
global.URL.revokeObjectURL = vi.fn()

const img1: FleaMarketImage = { id: 'img-1', storage_path: 'a/1.jpg', sort_order: 0 }
const img2: FleaMarketImage = { id: 'img-2', storage_path: 'a/2.jpg', sort_order: 1 }

function makeFile(name: string) {
  return new File(['x'], name, { type: 'image/jpeg' })
}

describe('useImageDraft', () => {
  it('initialises with sorted existing images', () => {
    const { result } = renderHook(() => useImageDraft([img2, img1]))
    expect(result.current.existingImages[0].id).toBe('img-1')
    expect(result.current.existingImages[1].id).toBe('img-2')
  })

  it('addFiles appends new files and creates previews', () => {
    const { result } = renderHook(() => useImageDraft())
    act(() => result.current.addFiles([makeFile('a.jpg')]))
    expect(result.current.newFiles).toHaveLength(1)
    expect(result.current.newPreviews).toHaveLength(1)
  })

  it('addFiles respects MAX_IMAGES = 6 cap', () => {
    const existing = Array.from({ length: 5 }, (_, i) => ({ ...img1, id: `img-${i}`, sort_order: i }))
    const { result } = renderHook(() => useImageDraft(existing))
    act(() => result.current.addFiles([makeFile('x.jpg'), makeFile('y.jpg')]))
    expect(result.current.newFiles).toHaveLength(1)
  })

  it('removeExisting marks as _deleted', () => {
    const { result } = renderHook(() => useImageDraft([img1]))
    act(() => result.current.removeExisting('img-1'))
    expect(result.current.existingImages[0]._deleted).toBe(true)
    expect(result.current.totalCount).toBe(0)
  })

  it('undoRemoveExisting clears _deleted', () => {
    const { result } = renderHook(() => useImageDraft([img1]))
    act(() => {
      result.current.removeExisting('img-1')
      result.current.undoRemoveExisting('img-1')
    })
    expect(result.current.existingImages[0]._deleted).toBe(false)
  })

  it('removeNew removes file by index', () => {
    const { result } = renderHook(() => useImageDraft())
    act(() => result.current.addFiles([makeFile('a.jpg'), makeFile('b.jpg')]))
    act(() => result.current.removeNew(0))
    expect(result.current.newFiles).toHaveLength(1)
    expect(result.current.newFiles[0].name).toBe('b.jpg')
  })

  it('serialize returns add:newFiles and remove:deletedExisting', () => {
    const { result } = renderHook(() => useImageDraft([img1, img2]))
    act(() => {
      result.current.removeExisting('img-1')
      result.current.addFiles([makeFile('new.jpg')])
    })
    const s = result.current.serialize()
    expect(s.add).toHaveLength(1)
    expect(s.remove).toHaveLength(1)
    expect(s.remove[0].id).toBe('img-1')
  })

  it('returned object is stable across renders when state unchanged', () => {
    const { result, rerender } = renderHook(() => useImageDraft([img1]))
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})
