import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, beforeEach, expect } from 'vitest'
import EditProfilePage from './page'

const mockReplace = vi.fn()
const mockPush = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}))

vi.mock('@/lib/feature-flags', () => ({ features: { payments: true, skyltfonstret: true } }))

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: {
    organizers: {
      get: vi.fn(),
      update: vi.fn(),
    },
    edge: {
      invoke: vi.fn(),
    },
  },
}))

vi.mock('@/components/fyndstigen-logo', () => ({
  FyndstigenLogo: () => <div data-testid="loading-logo" />,
}))

// Import mocked modules after vi.mock calls
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'

const freeProfile = {
  id: 'user-1',
  first_name: 'Anna',
  last_name: 'Svensson',
  phone_number: null,
  bio: null,
  website: null,
  logo_path: null,
  subscription_tier: 0,
}

const premiumProfile = { ...freeProfile, subscription_tier: 1 }

const mockUser = { id: 'user-1', email: 'anna@test.se' }

beforeEach(() => {
  vi.clearAllMocks()
  mockSearchParams = new URLSearchParams()
  vi.mocked(api.organizers.get).mockResolvedValue(freeProfile as any)
  vi.mocked(useAuth).mockReturnValue({
    user: mockUser as any,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  })
})

describe('EditProfilePage', () => {
  it('shows loading state while fetching profile', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    })
    render(<EditProfilePage />)
    expect(screen.getByTestId('loading-logo')).toBeInTheDocument()
  })

  it('redirects to /auth when not logged in', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    })
    render(<EditProfilePage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/auth')
    })
  })

  it('free tier: shows upgrade section with correct button text', async () => {
    vi.mocked(api.organizers.get).mockResolvedValue(freeProfile as any)
    render(<EditProfilePage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Uppgradera — 69 kr\/mån/i })).toBeInTheDocument()
    })
  })

  it('free tier: shows benefit list with checkmarks', async () => {
    vi.mocked(api.organizers.get).mockResolvedValue(freeProfile as any)
    render(<EditProfilePage />)
    await waitFor(() => {
      expect(screen.getByText(/Bättre synlighet på Google/i)).toBeInTheDocument()
      expect(screen.getByText(/Sidvisningar och konvertering/i)).toBeInTheDocument()
      expect(screen.getByText(/Statistik per loppis/i)).toBeInTheDocument()
    })
  })

  it('free tier: upgrade button calls skyltfonstret-checkout and sets window.location.href', async () => {
    const checkoutUrl = 'https://checkout.stripe.com/test-session'
    vi.mocked(api.edge.invoke).mockResolvedValue({ url: checkoutUrl } as any)
    vi.mocked(api.organizers.get).mockResolvedValue(freeProfile as any)

    let capturedHref = ''
    const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location')
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        get href() { return capturedHref },
        set href(v: string) { capturedHref = v },
      },
    })

    render(<EditProfilePage />)

    const upgradeBtn = await screen.findByRole('button', { name: /Uppgradera — 69 kr\/mån/i })
    fireEvent.click(upgradeBtn)

    await waitFor(() => {
      expect(vi.mocked(api.edge.invoke)).toHaveBeenCalledWith('skyltfonstret-checkout')
    })

    await waitFor(() => {
      expect(capturedHref).toBe(checkoutUrl)
    })

    // Restore
    if (locationDescriptor) {
      Object.defineProperty(window, 'location', locationDescriptor)
    }
  })

  it('premium tier: shows active badge with "Skyltfönstret" and "Aktivt"', async () => {
    vi.mocked(api.organizers.get).mockResolvedValue(premiumProfile as any)
    render(<EditProfilePage />)
    await waitFor(() => {
      expect(screen.getByText('Skyltfönstret')).toBeInTheDocument()
      expect(screen.getByText('Aktivt')).toBeInTheDocument()
    })
  })

  it('premium tier: shows manage subscription button', async () => {
    vi.mocked(api.organizers.get).mockResolvedValue(premiumProfile as any)
    render(<EditProfilePage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Hantera prenumeration/i })).toBeInTheDocument()
    })
  })

  it('premium tier: manage button calls skyltfonstret-portal and sets window.location.href', async () => {
    const portalUrl = 'https://billing.stripe.com/test-portal'
    vi.mocked(api.edge.invoke).mockResolvedValue({ url: portalUrl } as any)
    vi.mocked(api.organizers.get).mockResolvedValue(premiumProfile as any)

    let capturedHref = ''
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        get href() { return capturedHref },
        set href(v: string) { capturedHref = v },
      },
    })

    render(<EditProfilePage />)

    const manageBtn = await screen.findByRole('button', { name: /Hantera prenumeration/i })
    fireEvent.click(manageBtn)

    await waitFor(() => {
      expect(vi.mocked(api.edge.invoke)).toHaveBeenCalledWith('skyltfonstret-portal')
    })

    await waitFor(() => {
      expect(capturedHref).toBe(portalUrl)
    })
  })

  it('shows success banner when URL has ?skyltfonstret=active', async () => {
    mockSearchParams = new URLSearchParams('skyltfonstret=active')
    render(<EditProfilePage />)
    await waitFor(() => {
      expect(screen.getByText(/Skyltfönstret är aktiverat/i)).toBeInTheDocument()
    })
  })

  it('success banner auto-removes query param via router.replace', async () => {
    mockSearchParams = new URLSearchParams('skyltfonstret=active')
    render(<EditProfilePage />)
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/profile/edit', { scroll: false })
    })
  })
})
