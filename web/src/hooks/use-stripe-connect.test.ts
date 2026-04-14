import { renderHook, waitFor, act } from '@testing-library/react'
import { useStripeConnect } from './use-stripe-connect'

// Mock supabase
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

// Mock window.location
const mockLocationHref = vi.fn()
Object.defineProperty(window, 'location', {
  value: { href: '' },
  writable: true,
})

describe('useStripeConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue({
      data: { connected: false, onboarding_complete: false },
      error: null,
    })
  })

  it('returns loading=true initially', () => {
    const { result } = renderHook(() => useStripeConnect('user-1'))
    expect(result.current.loading).toBe(true)
  })

  it('returns loading=false with no userId', async () => {
    const { result } = renderHook(() => useStripeConnect(undefined))
    expect(result.current.loading).toBe(false)
    expect(result.current.connected).toBe(false)
  })

  it('fetches status on mount', async () => {
    mockInvoke.mockResolvedValue({
      data: { connected: true, onboarding_complete: true },
      error: null,
    })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.connected).toBe(true)
    expect(result.current.onboardingComplete).toBe(true)
    expect(mockInvoke).toHaveBeenCalledWith('stripe-connect-status', expect.anything())
  })

  it('handles not connected state', async () => {
    mockInvoke.mockResolvedValue({
      data: { connected: false, onboarding_complete: false },
      error: null,
    })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.connected).toBe(false)
    expect(result.current.onboardingComplete).toBe(false)
  })

  it('handles partial onboarding (connected but not complete)', async () => {
    mockInvoke.mockResolvedValue({
      data: { connected: true, onboarding_complete: false },
      error: null,
    })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.connected).toBe(true)
    expect(result.current.onboardingComplete).toBe(false)
  })

  it('sets error on status fetch failure', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Network error'),
    })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })

  it('startOnboarding calls create and redirects', async () => {
    // First call: status check
    mockInvoke.mockResolvedValueOnce({
      data: { connected: false, onboarding_complete: false },
      error: null,
    })
    // Second call: create
    mockInvoke.mockResolvedValueOnce({
      data: { url: 'https://connect.stripe.com/setup/abc' },
      error: null,
    })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.startOnboarding()
    })

    expect(mockInvoke).toHaveBeenCalledWith('stripe-connect-create', expect.anything())
    expect(window.location.href).toBe('https://connect.stripe.com/setup/abc')
  })

  it('refreshOnboarding calls refresh and redirects', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { connected: true, onboarding_complete: false },
      error: null,
    })
    mockInvoke.mockResolvedValueOnce({
      data: { url: 'https://connect.stripe.com/setup/def' },
      error: null,
    })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.refreshOnboarding()
    })

    expect(mockInvoke).toHaveBeenCalledWith('stripe-connect-refresh', expect.anything())
    expect(window.location.href).toBe('https://connect.stripe.com/setup/def')
  })

  it('startOnboarding sets error on failure', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { connected: false, onboarding_complete: false },
      error: null,
    })
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error('Failed'),
    })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.startOnboarding()
    })

    expect(result.current.error).toBeTruthy()
  })
})
