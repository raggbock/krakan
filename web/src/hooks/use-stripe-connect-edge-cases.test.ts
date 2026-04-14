import { renderHook, waitFor, act } from '@testing-library/react'
import { useStripeConnect } from './use-stripe-connect'

const mockInvoke = vi.fn()
const mockGetSession = vi.fn().mockResolvedValue({
  data: { session: { access_token: 'test-token' } },
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}))

describe('useStripeConnect — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.location.href = ''
    mockInvoke.mockResolvedValue({
      data: { connected: false, onboarding_complete: false },
      error: null,
    })
  })

  it('does not fetch status when userId is undefined', async () => {
    const { result } = renderHook(() => useStripeConnect(undefined))

    // Should immediately be not loading, no fetch
    expect(result.current.loading).toBe(false)
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('does not fetch status when userId is empty string', async () => {
    const { result } = renderHook(() => useStripeConnect(undefined))

    expect(result.current.loading).toBe(false)
    expect(result.current.connected).toBe(false)
    expect(result.current.onboardingComplete).toBe(false)
  })

  it('does not redirect on startOnboarding failure', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { connected: false, onboarding_complete: false },
      error: null,
    })
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error('Stripe API down'),
    })

    const { result } = renderHook(() => useStripeConnect('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const hrefBefore = window.location.href
    await act(async () => { await result.current.startOnboarding() })

    expect(window.location.href).toBe(hrefBefore)
    expect(result.current.error).toBeTruthy()
  })

  it('does not redirect on refreshOnboarding failure', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { connected: true, onboarding_complete: false },
      error: null,
    })
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error('Account not found'),
    })

    const { result } = renderHook(() => useStripeConnect('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.refreshOnboarding() })

    expect(result.current.error).toBeTruthy()
  })

  it('clears error when startOnboarding succeeds after failure', async () => {
    // Status check
    mockInvoke.mockResolvedValueOnce({
      data: { connected: false, onboarding_complete: false },
      error: null,
    })
    // First onboarding attempt: fail
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error('Temporary failure'),
    })

    const { result } = renderHook(() => useStripeConnect('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.startOnboarding() })
    expect(result.current.error).toBeTruthy()

    // Second attempt: success
    mockInvoke.mockResolvedValueOnce({
      data: { url: 'https://connect.stripe.com/setup/retry' },
      error: null,
    })

    await act(async () => { await result.current.startOnboarding() })
    expect(result.current.error).toBeNull()
  })

  it('passes correct function names to supabase invoke', async () => {
    mockInvoke.mockResolvedValue({
      data: { connected: false, onboarding_complete: false },
      error: null,
    })

    const { result } = renderHook(() => useStripeConnect('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockInvoke).toHaveBeenCalledWith('stripe-connect-status', expect.anything())

    mockInvoke.mockResolvedValueOnce({
      data: { url: 'https://stripe.com' },
      error: null,
    })
    await act(async () => { await result.current.startOnboarding() })
    expect(mockInvoke).toHaveBeenCalledWith('stripe-connect-create', expect.anything())

    mockInvoke.mockResolvedValueOnce({
      data: { url: 'https://stripe.com' },
      error: null,
    })
    await act(async () => { await result.current.refreshOnboarding() })
    expect(mockInvoke).toHaveBeenCalledWith('stripe-connect-refresh', expect.anything())
  })

  it('all three functions pass authorization header', async () => {
    mockInvoke.mockResolvedValue({
      data: { connected: false, onboarding_complete: false, url: 'https://stripe.com' },
      error: null,
    })

    const { result } = renderHook(() => useStripeConnect('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Status check had auth header
    expect(mockInvoke).toHaveBeenCalledWith('stripe-connect-status', expect.objectContaining({
      headers: { Authorization: 'Bearer test-token' },
    }))

    await act(async () => { await result.current.startOnboarding() })
    expect(mockInvoke).toHaveBeenCalledWith('stripe-connect-create', expect.objectContaining({
      headers: { Authorization: 'Bearer test-token' },
    }))
  })
})
