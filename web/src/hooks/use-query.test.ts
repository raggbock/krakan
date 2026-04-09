import { renderHook, act, waitFor } from '@testing-library/react'
import { useQuery, useMutation } from './use-query'

describe('useQuery', () => {
  it('fetches data on mount', async () => {
    const fetcher = vi.fn().mockResolvedValue({ name: 'test' })
    const { result } = renderHook(() => useQuery(fetcher))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ name: 'test' })
    expect(result.current.error).toBeNull()
  })

  it('sets error on failure', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() =>
      useQuery(fetcher, { errorMessage: 'Gick fel' }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('Gick fel')
  })

  it('skips fetch when enabled is false', async () => {
    const fetcher = vi.fn().mockResolvedValue('data')
    const { result } = renderHook(() =>
      useQuery(fetcher, { enabled: false }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetcher).not.toHaveBeenCalled()
    expect(result.current.data).toBeNull()
  })

  it('refetches when deps change', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second')

    let dep = 'a'
    const { result, rerender } = renderHook(() =>
      useQuery(fetcher, { deps: [dep] }),
    )

    await waitFor(() => expect(result.current.data).toBe('first'))

    dep = 'b'
    rerender()

    await waitFor(() => expect(result.current.data).toBe('second'))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('ignores stale responses', async () => {
    let resolveFirst: (v: string) => void
    let resolveSecond: (v: string) => void

    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise<string>((r) => { resolveFirst = r }))
      .mockImplementationOnce(() => new Promise<string>((r) => { resolveSecond = r }))

    let dep = 'a'
    const { result, rerender } = renderHook(() =>
      useQuery(fetcher, { deps: [dep] }),
    )

    // Trigger second fetch before first resolves
    dep = 'b'
    rerender()

    // Resolve second first, then first
    await act(async () => { resolveSecond!('second') })
    await act(async () => { resolveFirst!('first') })

    // Should show second, not first (stale)
    expect(result.current.data).toBe('second')
  })

  it('refetch re-fires the fetcher', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce('initial')
      .mockResolvedValueOnce('refreshed')

    const { result } = renderHook(() => useQuery(fetcher))

    await waitFor(() => expect(result.current.data).toBe('initial'))

    await act(async () => { result.current.refetch() })

    await waitFor(() => expect(result.current.data).toBe('refreshed'))
  })
})

describe('useMutation', () => {
  it('calls action and returns result', async () => {
    const action = vi.fn().mockResolvedValue({ id: '123' })
    const onSuccess = vi.fn()

    const { result } = renderHook(() =>
      useMutation(action, { onSuccess }),
    )

    expect(result.current.loading).toBe(false)

    let returned: unknown
    await act(async () => {
      returned = await result.current.mutate({ name: 'test' })
    })

    expect(returned).toEqual({ id: '123' })
    expect(onSuccess).toHaveBeenCalledWith({ id: '123' })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets error on failure', async () => {
    const action = vi.fn().mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() =>
      useMutation(action, { errorMessage: 'Misslyckades' }),
    )

    await act(async () => {
      await result.current.mutate({})
    })

    expect(result.current.error).toBe('Misslyckades')
  })

  it('prevents double submit while loading', async () => {
    let resolve: (v: string) => void
    const action = vi.fn().mockImplementation(
      () => new Promise<string>((r) => { resolve = r }),
    )

    const { result } = renderHook(() => useMutation(action))

    // First call
    act(() => { result.current.mutate({}) })
    expect(result.current.loading).toBe(true)

    // Second call while loading — should be ignored
    await act(async () => {
      const secondResult = await result.current.mutate({})
      expect(secondResult).toBeUndefined()
    })

    expect(action).toHaveBeenCalledTimes(1)

    // Resolve first
    await act(async () => { resolve!('done') })
  })

  it('reset clears error', async () => {
    const action = vi.fn().mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useMutation(action))

    await act(async () => { await result.current.mutate({}) })
    expect(result.current.error).toBeTruthy()

    act(() => { result.current.reset() })
    expect(result.current.error).toBeNull()
  })
})
