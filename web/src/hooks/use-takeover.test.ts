import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock endpoints before importing the hooks
const mockTakeoverInfo = vi.fn()
const mockTakeoverStart = vi.fn()
const mockTakeoverFeedback = vi.fn()
const mockTakeoverRemove = vi.fn()

vi.mock('@/lib/edge', () => ({
  edge: { invoke: vi.fn(), invokePublic: vi.fn() },
  endpoints: {
    'takeover.info': { invoke: (...args: unknown[]) => mockTakeoverInfo(...args) },
    'takeover.start': { invoke: (...args: unknown[]) => mockTakeoverStart(...args) },
    'takeover.feedback': { invoke: (...args: unknown[]) => mockTakeoverFeedback(...args) },
    'takeover.remove': { invoke: (...args: unknown[]) => mockTakeoverRemove(...args) },
  },
}))

import {
  useTakeoverInfo,
  useTakeoverStart,
  useTakeoverFeedback,
  useTakeoverRemove,
} from './use-takeover'

// ─── Test wrapper ──────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  return Wrapper
}

// ─── useTakeoverInfo ───────────────────────────────────────────────────────

describe('useTakeoverInfo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes takeover.info with the token when token is provided', async () => {
    const token = 'a'.repeat(20)
    mockTakeoverInfo.mockResolvedValue({ name: 'Loppis' })

    const { result } = renderHook(() => useTakeoverInfo(token), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockTakeoverInfo).toHaveBeenCalledWith({ token })
  })

  it('stays disabled (does not fetch) when token is null', () => {
    const { result } = renderHook(() => useTakeoverInfo(null), {
      wrapper: makeWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockTakeoverInfo).not.toHaveBeenCalled()
  })

  it('does not retry on error', async () => {
    const token = 'a'.repeat(20)
    mockTakeoverInfo.mockRejectedValue(new Error('not found'))

    const { result } = renderHook(() => useTakeoverInfo(token), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    // retry: false means the endpoint is called exactly once
    expect(mockTakeoverInfo).toHaveBeenCalledTimes(1)
  })
})

// ─── useTakeoverStart ──────────────────────────────────────────────────────

describe('useTakeoverStart', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes takeover.start with token and email', async () => {
    mockTakeoverStart.mockResolvedValue({ ok: true, magicLinkSent: true })

    const { result } = renderHook(() => useTakeoverStart(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.mutateAsync({ token: 'a'.repeat(20), email: 'user@example.com' })
    })

    expect(mockTakeoverStart).toHaveBeenCalledWith({
      token: 'a'.repeat(20),
      email: 'user@example.com',
    })
  })

  it('surfaces error when invocation fails', async () => {
    mockTakeoverStart.mockRejectedValue(new Error('invalid token'))

    const { result } = renderHook(() => useTakeoverStart(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.mutate({ token: 'a'.repeat(20), email: 'user@example.com' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })
})

// ─── useTakeoverFeedback ───────────────────────────────────────────────────

describe('useTakeoverFeedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes takeover.feedback with token, email, and message', async () => {
    mockTakeoverFeedback.mockResolvedValue({ ok: true })

    const { result } = renderHook(() => useTakeoverFeedback(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.mutateAsync({
        token: 'a'.repeat(20),
        email: 'user@example.com',
        message: 'Ser bra ut!',
      })
    })

    expect(mockTakeoverFeedback).toHaveBeenCalledWith({
      token: 'a'.repeat(20),
      email: 'user@example.com',
      message: 'Ser bra ut!',
    })
  })

  it('surfaces error when invocation fails', async () => {
    mockTakeoverFeedback.mockRejectedValue(new Error('server error'))

    const { result } = renderHook(() => useTakeoverFeedback(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.mutate({
        token: 'a'.repeat(20),
        email: 'user@example.com',
        message: 'Hej',
      })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ─── useTakeoverRemove ─────────────────────────────────────────────────────

describe('useTakeoverRemove', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes takeover.remove with token and no reason', async () => {
    mockTakeoverRemove.mockResolvedValue({ ok: true })

    const { result } = renderHook(() => useTakeoverRemove(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.mutateAsync({ token: 'a'.repeat(20) })
    })

    expect(mockTakeoverRemove).toHaveBeenCalledWith({ token: 'a'.repeat(20) })
  })

  it('invokes takeover.remove with optional reason when provided', async () => {
    mockTakeoverRemove.mockResolvedValue({ ok: true })

    const { result } = renderHook(() => useTakeoverRemove(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.mutateAsync({ token: 'a'.repeat(20), reason: 'Dubblett' })
    })

    expect(mockTakeoverRemove).toHaveBeenCalledWith({
      token: 'a'.repeat(20),
      reason: 'Dubblett',
    })
  })

  it('surfaces error when invocation fails', async () => {
    mockTakeoverRemove.mockRejectedValue(new Error('not authorised'))

    const { result } = renderHook(() => useTakeoverRemove(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.mutate({ token: 'a'.repeat(20) })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
