import { render as rtlRender, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, beforeEach, expect } from 'vitest'
import EditMarketPage from './page'
import type { Deps } from '@fyndstigen/shared'
import { makeInMemoryDeps } from '@fyndstigen/shared/deps-factory'
import { DepsProvider } from '@/providers/deps-provider'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ---- Navigation mocks ----
const mockReplace = vi.fn()
const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: vi.fn() }),
  useParams: () => ({ id: 'fm-1' }),
}))

// ---- Auth mock ----
vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: vi.fn(),
}))

// ---- Logo mock ----
vi.mock('@/components/fyndstigen-logo', () => ({
  FyndstigenLogo: () => <div data-testid="loading-logo" />,
}))

// ---- useMarketDetails mock ----
const mockUseMarketDetails = vi.fn()
vi.mock('@/hooks/use-market-details', () => ({
  useMarketDetails: (id: string) => mockUseMarketDetails(id),
}))

// ---- useMarketForm mock — returns a minimal stable shape ----
vi.mock('@/hooks/market-form', () => ({
  useMarketForm: () => ({
    fields: {
      name: 'Test Loppis',
      setName: vi.fn(),
      description: '',
      setDescription: vi.fn(),
      address: '',
      setAddress: vi.fn(),
      isPermanent: false,
      setIsPermanent: vi.fn(),
      contactWebsite: '',
      setContactWebsite: vi.fn(),
      contactPhone: '',
      setContactPhone: vi.fn(),
      contactEmail: '',
      setContactEmail: vi.fn(),
      contactInstagram: '',
      setContactInstagram: vi.fn(),
      contactFacebook: '',
      setContactFacebook: vi.fn(),
      isValid: true,
    },
    openingHours: { rules: [], setRules: vi.fn(), exceptions: [], setExceptions: vi.fn() },
    images: {
      totalCount: 0,
      existingImages: [],
      newPreviews: [],
      addFiles: vi.fn(),
      removeExisting: vi.fn(),
      undoRemoveExisting: vi.fn(),
      removeNew: vi.fn(),
      resetNew: vi.fn(),
    },
    tables: {
      existingTables: [],
      newTables: [],
      addBatch: vi.fn(),
      markDeleted: vi.fn(),
      undoDelete: vi.fn(),
      removeNew: vi.fn(),
      resetNew: vi.fn(),
    },
    submit: vi.fn().mockResolvedValue({ ok: true }),
    status: {
      isSubmitting: false,
      success: null,
      error: null,
      imageStatuses: [],
    },
    clearError: vi.fn(),
  }),
}))

// ---- Section component mocks ----
vi.mock('@/components/market-form/MarketBasicInfoSection', () => ({
  MarketBasicInfoSection: () => <div data-testid="basic-info-section" />,
}))
vi.mock('@/components/market-form/MarketContactSection', () => ({
  MarketContactSection: () => <div data-testid="contact-section" />,
}))
vi.mock('@/components/market-form/OpeningHoursSection', () => ({
  OpeningHoursSection: () => <div data-testid="opening-hours-section" />,
}))
vi.mock('@/components/market-form/MarketTableAddForm', () => ({
  MarketTableAddForm: () => <div data-testid="table-add-form" />,
}))
vi.mock('@/components/image-upload-list', () => ({
  ImageUploadList: () => <div data-testid="image-upload-list" />,
}))

// ---- Deps setup ----
const mockPublish = vi.fn()
const mockUnpublish = vi.fn()
const mockDelete = vi.fn()

const testDeps: Deps = (() => {
  const base = makeInMemoryDeps()
  return {
    ...base,
    markets: {
      ...base.markets,
      publish: mockPublish,
      unpublish: mockUnpublish,
      delete: mockDelete,
    },
    images: {
      ...base.images,
      publicUrl: (path: string) => `/storage/${path}`,
    },
  }
})()

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

const render = (ui: React.ReactElement) => {
  const queryClient = makeQueryClient()
  return rtlRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(DepsProvider, { deps: testDeps }, children),
      ),
  })
}

import { useAuth } from '@/lib/auth/auth-context'

const mockUser = { id: 'user-1', email: 'org@test.se' }

const draftMarket = {
  id: 'fm-1',
  organizerId: 'user-1',
  name: 'Test Loppis',
  publishedAt: null,
  slug: null,
  description: null,
  address: '',
  latitude: 59.0,
  longitude: 18.0,
  images: [],
  openingHourRules: [],
  openingHourExceptions: [],
  organizerName: 'Org',
  contactWebsite: null,
  contactPhone: null,
  contactEmail: null,
  contactInstagram: null,
  contactFacebook: null,
  isPermanent: false,
  status: 'open' as const,
}

const publishedMarket = {
  ...draftMarket,
  publishedAt: '2026-01-01T10:00:00Z',
  slug: 'test-loppis',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue({
    user: mockUser as any,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  })
  mockPublish.mockResolvedValue(undefined)
  mockUnpublish.mockResolvedValue(undefined)
  mockDelete.mockResolvedValue(undefined)
})

describe('EditMarketPage — publish/unpublish toggle', () => {
  it('draft market shows "Redo att publicera?" card and publish button', async () => {
    mockUseMarketDetails.mockReturnValue({
      market: draftMarket,
      tables: [],
      loading: false,
      error: null,
    })
    render(<EditMarketPage />)
    await waitFor(() => {
      expect(screen.getByText('Redo att publicera?')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Publicera loppisen/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /Avpublicera/i })).not.toBeInTheDocument()
  })

  it('published market shows "Publicerad" status and Avpublicera button, no publish card', async () => {
    mockUseMarketDetails.mockReturnValue({
      market: publishedMarket,
      tables: [],
      loading: false,
      error: null,
    })
    render(<EditMarketPage />)
    await waitFor(() => {
      expect(screen.getByText(/Publicerad — syns för besökare/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Avpublicera/i })).toBeInTheDocument()
    })
    expect(screen.queryByText('Redo att publicera?')).not.toBeInTheDocument()
  })

  it('clicking Avpublicera calls markets.unpublish and flips to draft state', async () => {
    mockUseMarketDetails.mockReturnValue({
      market: publishedMarket,
      tables: [],
      loading: false,
      error: null,
    })
    render(<EditMarketPage />)

    const btn = await screen.findByRole('button', { name: /Avpublicera/i })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(mockUnpublish).toHaveBeenCalledWith('fm-1')
    })

    // After unpublish succeeds, draft card should appear
    await waitFor(() => {
      expect(screen.getByText('Redo att publicera?')).toBeInTheDocument()
    })
  })

  it('clicking Publicera loppisen calls markets.publish and flips to published state', async () => {
    mockUseMarketDetails.mockReturnValue({
      market: draftMarket,
      tables: [],
      loading: false,
      error: null,
    })
    render(<EditMarketPage />)

    const btn = await screen.findByRole('button', { name: /Publicera loppisen/i })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(mockPublish).toHaveBeenCalledWith('fm-1')
    })

    // After publish succeeds, published card should appear
    await waitFor(() => {
      expect(screen.getByText(/Publicerad — syns för besökare/i)).toBeInTheDocument()
    })
  })
})

describe('EditMarketPage — Ta bort loppis (danger zone)', () => {
  beforeEach(() => {
    mockUseMarketDetails.mockReturnValue({
      market: draftMarket,
      tables: [],
      loading: false,
      error: null,
    })
  })

  it('shows "Ta bort loppis" section with initial button', async () => {
    render(<EditMarketPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Ta bort loppis/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /^Ta bort loppis$/i })).toBeInTheDocument()
    expect(screen.queryByText(/Är du säker/i)).not.toBeInTheDocument()
  })

  it('clicking "Ta bort loppis" shows inline confirm', async () => {
    render(<EditMarketPage />)

    const deleteBtn = await screen.findByRole('button', { name: /^Ta bort loppis$/i })
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.getByText(/Är du säker\? Loppisen tas bort\./i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Ja, ta bort/i })).toBeInTheDocument()
      // There may be multiple "Avbryt" buttons (cancel in confirm + form cancel link)
      expect(screen.getAllByRole('button', { name: /Avbryt/i }).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('"Ja, ta bort" calls markets.delete and navigates to /profile', async () => {
    render(<EditMarketPage />)

    const deleteBtn = await screen.findByRole('button', { name: /^Ta bort loppis$/i })
    fireEvent.click(deleteBtn)

    const confirmBtn = await screen.findByRole('button', { name: /Ja, ta bort/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('fm-1')
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/profile')
    })
  })

  it('"Avbryt" in confirm state hides the confirm without calling delete', async () => {
    render(<EditMarketPage />)

    const deleteBtn = await screen.findByRole('button', { name: /^Ta bort loppis$/i })
    fireEvent.click(deleteBtn)

    // Find the Avbryt button in the confirm row (it's a button, not a Link)
    const avbrytBtns = await screen.findAllByRole('button', { name: /Avbryt/i })
    fireEvent.click(avbrytBtns[0])

    await waitFor(() => {
      expect(screen.queryByText(/Är du säker/i)).not.toBeInTheDocument()
    })
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
