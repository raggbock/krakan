import { renderHook, waitFor, act } from '@testing-library/react'
import { useStripeConnect } from './use-stripe-connect'

// Mock endpoint invokers
const mockInvokeStatus = vi.fn()
const mockInvokeCreate = vi.fn()
const mockInvokeRefresh = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    endpoints: {
      'stripe.connect.status': { invoke: (...args: unknown[]) => mockInvokeStatus(...args) },
      'stripe.connect.create': { invoke: (...args: unknown[]) => mockInvokeCreate(...args) },
      'stripe.connect.refresh': { invoke: (...args: unknown[]) => mockInvokeRefresh(...args) },
    },
  },
}))

vi.mock('@/lib/edge', () => ({
  edge: { invoke: vi.fn(), invokePublic: vi.fn() },
  endpoints: {
    'stripe.connect.status': { invoke: (...args: unknown[]) => mockInvokeStatus(...args) },
    'stripe.connect.create': { invoke: (...args: unknown[]) => mockInvokeCreate(...args) },
    'stripe.connect.refresh': { invoke: (...args: unknown[]) => mockInvokeRefresh(...args) },
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
    mockInvokeStatus.mockResolvedValue({ connected: false, onboarding_complete: false })
    mockInvokeCreate.mockResolvedValue({ url: '' })
    mockInvokeRefresh.mockResolvedValue({ url: '' })
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
    mockInvokeStatus.mockResolvedValue({ connected: true, onboarding_complete: true })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.connected).toBe(true)
    expect(result.current.onboardingComplete).toBe(true)
    expect(mockInvokeStatus).toHaveBeenCalledWith({})
  })

  it('handles not connected state', async () => {
    mockInvokeStatus.mockResolvedValue({ connected: false, onboarding_complete: false })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.connected).toBe(false)
    expect(result.current.onboardingComplete).toBe(false)
  })

  it('handles partial onboarding (connected but not complete)', async () => {
    mockInvokeStatus.mockResolvedValue({ connected: true, onboarding_complete: false })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.connected).toBe(true)
    expect(result.current.onboardingComplete).toBe(false)
  })

  it('sets error on status fetch failure', async () => {
    mockInvokeStatus.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })

  it('startOnboarding calls create and redirects', async () => {
    mockInvokeStatus.mockResolvedValue({ connected: false, onboarding_complete: false })
    mockInvokeCreate.mockResolvedValue({ url: 'https://connect.stripe.com/setup/abc' })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.startOnboarding()
    })

    expect(mockInvokeCreate).toHaveBeenCalledWith({})
    expect(window.location.href).toBe('https://connect.stripe.com/setup/abc')
  })

  it('refreshOnboarding calls refresh and redirects', async () => {
    mockInvokeStatus.mockResolvedValue({ connected: true, onboarding_complete: false })
    mockInvokeRefresh.mockResolvedValue({ url: 'https://connect.stripe.com/setup/def' })

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.refreshOnboarding()
    })

    expect(mockInvokeRefresh).toHaveBeenCalledWith({})
    expect(window.location.href).toBe('https://connect.stripe.com/setup/def')
  })

  it('startOnboarding sets error on failure', async () => {
    mockInvokeStatus.mockResolvedValue({ connected: false, onboarding_complete: false })
    mockInvokeCreate.mockRejectedValue(new Error('Failed'))

    const { result } = renderHook(() => useStripeConnect('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.startOnboarding()
    })

    expect(result.current.error).toBeTruthy()
  })
})
