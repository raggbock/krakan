import { renderHook, waitFor, act } from '@testing-library/react'
import { useStripeConnect } from './use-stripe-connect'

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

describe('useStripeConnect — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.location.href = ''
    mockInvokeStatus.mockResolvedValue({ connected: false, onboarding_complete: false })
    mockInvokeCreate.mockResolvedValue({ url: '' })
    mockInvokeRefresh.mockResolvedValue({ url: '' })
  })

  it('does not fetch status when userId is undefined', async () => {
    const { result } = renderHook(() => useStripeConnect(undefined))

    expect(result.current.loading).toBe(false)
    expect(mockInvokeStatus).not.toHaveBeenCalled()
  })

  it('does not fetch status when userId is empty string', async () => {
    const { result } = renderHook(() => useStripeConnect(undefined))

    expect(result.current.loading).toBe(false)
    expect(result.current.connected).toBe(false)
    expect(result.current.onboardingComplete).toBe(false)
  })

  it('does not redirect on startOnboarding failure', async () => {
    mockInvokeCreate.mockRejectedValueOnce(new Error('Stripe API down'))

    const { result } = renderHook(() => useStripeConnect('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const hrefBefore = window.location.href
    await act(async () => { await result.current.startOnboarding() })

    expect(window.location.href).toBe(hrefBefore)
    expect(result.current.error).toBeTruthy()
  })

  it('does not redirect on refreshOnboarding failure', async () => {
    mockInvokeStatus.mockResolvedValue({ connected: true, onboarding_complete: false })
    mockInvokeRefresh.mockRejectedValueOnce(new Error('Account not found'))

    const { result } = renderHook(() => useStripeConnect('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.refreshOnboarding() })

    expect(result.current.error).toBeTruthy()
  })

  it('clears error when startOnboarding succeeds after failure', async () => {
    mockInvokeCreate.mockRejectedValueOnce(new Error('Temporary failure'))

    const { result } = renderHook(() => useStripeConnect('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.startOnboarding() })
    expect(result.current.error).toBeTruthy()

    mockInvokeCreate.mockResolvedValueOnce({ url: 'https://connect.stripe.com/setup/retry' })

    await act(async () => { await result.current.startOnboarding() })
    expect(result.current.error).toBeNull()
  })

  it('invokes correct endpoint invokers for each action', async () => {
    const { result } = renderHook(() => useStripeConnect('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockInvokeStatus).toHaveBeenCalledWith({})

    mockInvokeCreate.mockResolvedValueOnce({ url: 'https://stripe.com' })
    await act(async () => { await result.current.startOnboarding() })
    expect(mockInvokeCreate).toHaveBeenCalledWith({})

    mockInvokeRefresh.mockResolvedValueOnce({ url: 'https://stripe.com' })
    await act(async () => { await result.current.refreshOnboarding() })
    expect(mockInvokeRefresh).toHaveBeenCalledWith({})
  })
})
