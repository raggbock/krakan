import { renderHook, waitFor, act } from '@testing-library/react'
import { useStripeConnect } from './use-stripe-connect'

// Mock api.edge.invoke
const mockInvoke = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    edge: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}))

// Mock window.location
Object.defineProperty(window, 'location', {
  value: { href: '' },
  writable: true,
})

describe('useStripeConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue({ connected: false, onboarding_complete: false })
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
    mockInvoke.mockResolvedValue({ connected: true, onboarding_complete: true })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.connected).toBe(true)
    expect(result.current.onboardingComplete).toBe(true)
    expect(mockInvoke).toHaveBeenCalledWith('stripe-connect-status')
  })

  it('handles not connected state', async () => {
    mockInvoke.mockResolvedValue({ connected: false, onboarding_complete: false })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.connected).toBe(false)
    expect(result.current.onboardingComplete).toBe(false)
  })

  it('handles partial onboarding (connected but not complete)', async () => {
    mockInvoke.mockResolvedValue({ connected: true, onboarding_complete: false })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.connected).toBe(true)
    expect(result.current.onboardingComplete).toBe(false)
  })

  it('sets error on status fetch failure', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })

  it('startOnboarding calls create and redirects', async () => {
    mockInvoke.mockResolvedValueOnce({ connected: false, onboarding_complete: false })
    mockInvoke.mockResolvedValueOnce({ url: 'https://connect.stripe.com/setup/abc' })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.startOnboarding()
    })

    expect(mockInvoke).toHaveBeenCalledWith('stripe-connect-create')
    expect(window.location.href).toBe('https://connect.stripe.com/setup/abc')
  })

  it('refreshOnboarding calls refresh and redirects', async () => {
    mockInvoke.mockResolvedValueOnce({ connected: true, onboarding_complete: false })
    mockInvoke.mockResolvedValueOnce({ url: 'https://connect.stripe.com/setup/def' })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.refreshOnboarding()
    })

    expect(mockInvoke).toHaveBeenCalledWith('stripe-connect-refresh')
    expect(window.location.href).toBe('https://connect.stripe.com/setup/def')
  })

  it('startOnboarding sets error on failure', async () => {
    mockInvoke.mockResolvedValueOnce({ connected: false, onboarding_complete: false })
    mockInvoke.mockRejectedValueOnce(new Error('Failed'))

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.startOnboarding()
    })

    expect(result.current.error).toBeTruthy()
  })
})
