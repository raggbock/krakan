import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BlockSaleQueue } from './block-sale-queue'
import type { StandRow } from '@/hooks/use-block-sale-stands'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-block-sale-stands', () => ({
  useBlockSaleQueue: vi.fn(),
  useBlockSaleDecide: vi.fn(),
}))

import { useBlockSaleQueue, useBlockSaleDecide } from '@/hooks/use-block-sale-stands'
const mockUseQueue = useBlockSaleQueue as ReturnType<typeof vi.fn>
const mockUseDecide = useBlockSaleDecide as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStand(overrides: Partial<StandRow> = {}): StandRow {
  return {
    id: 'stand-001',
    applicant_name: 'Anna Svensson',
    applicant_email: 'anna@example.com',
    street: 'Regnbågsgatan 5',
    city: 'Stockholm',
    description: 'Böcker och porslin',
    status: 'pending',
    created_at: new Date().toISOString(),
    latitude: null,
    longitude: null,
    ...overrides,
  }
}

const DEFAULT_DECIDE = {
  mutateAsync: vi.fn(),
  isPending: false,
}

const DEFAULT_PROPS = {
  slug: 'test-loppis-2025',
  blockSaleId: 'bs-001',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BlockSaleQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseDecide.mockReturnValue({ ...DEFAULT_DECIDE, mutateAsync: vi.fn() })
  })

  it('renders status badges for each status variant', () => {
    const stands: StandRow[] = [
      makeStand({ id: 's1', status: 'pending',   applicant_name: 'Pending Person' }),
      makeStand({ id: 's2', status: 'confirmed', applicant_name: 'Confirmed Person' }),
      makeStand({ id: 's3', status: 'approved',  applicant_name: 'Approved Person' }),
      makeStand({ id: 's4', status: 'rejected',  applicant_name: 'Rejected Person' }),
    ]
    mockUseQueue.mockReturnValue({ data: stands, isLoading: false, error: null })

    render(<BlockSaleQueue {...DEFAULT_PROPS} />)

    expect(screen.getByText('Ej bekräftad')).toBeInTheDocument()
    expect(screen.getByText('Väntar')).toBeInTheDocument()
    expect(screen.getByText('Godkänd')).toBeInTheDocument()
    expect(screen.getByText('Avböjd')).toBeInTheDocument()
  })

  it('"Godkänn valda" button only triggers decide for confirmed stands, not pending', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ ok: true, decided: 1 })
    mockUseDecide.mockReturnValue({ ...DEFAULT_DECIDE, mutateAsync })

    const stands: StandRow[] = [
      makeStand({ id: 's-pending',   status: 'pending',   applicant_name: 'Pending' }),
      makeStand({ id: 's-confirmed', status: 'confirmed', applicant_name: 'Confirmed' }),
    ]
    mockUseQueue.mockReturnValue({ data: stands, isLoading: false, error: null })

    render(<BlockSaleQueue {...DEFAULT_PROPS} />)

    // Select all
    const selectAll = screen.getByLabelText('Markera alla')
    fireEvent.click(selectAll)

    // The "Godkänn valda" button shows count of actionable (confirmed) stands
    const approveBtn = screen.getByRole('button', { name: /Godkänn valda/i })
    fireEvent.click(approveBtn)

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          standIds: ['s-confirmed'], // only confirmed, NOT pending
          decision: 'approve',
        }),
      )
    })
  })

  it('selecting then bulk-approving clears the selection on success', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ ok: true, decided: 1 })
    mockUseDecide.mockReturnValue({ ...DEFAULT_DECIDE, mutateAsync })

    const stands: StandRow[] = [
      makeStand({ id: 's1', status: 'confirmed', applicant_name: 'Confirmed One' }),
    ]
    mockUseQueue.mockReturnValue({ data: stands, isLoading: false, error: null })

    render(<BlockSaleQueue {...DEFAULT_PROPS} />)

    // Select the stand
    fireEvent.click(screen.getByLabelText('Markera Confirmed One'))

    // Toolbar should appear showing 1 selected
    expect(screen.getByText('1 markerade')).toBeInTheDocument()

    // Bulk approve
    const approveBtn = screen.getByRole('button', { name: /Godkänn valda/i })
    fireEvent.click(approveBtn)

    await waitFor(() => {
      // Toolbar should disappear (selection cleared)
      expect(screen.queryByText('1 markerade')).not.toBeInTheDocument()
    })
  })

  it('per-row "Godkänn" button works for a confirmed stand', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ ok: true, decided: 1 })
    mockUseDecide.mockReturnValue({ ...DEFAULT_DECIDE, mutateAsync })

    const stands: StandRow[] = [
      makeStand({ id: 's-conf', status: 'confirmed', applicant_name: 'Björn Karlsson' }),
    ]
    mockUseQueue.mockReturnValue({ data: stands, isLoading: false, error: null })

    render(<BlockSaleQueue {...DEFAULT_PROPS} />)

    // The row-level approve button (text: "Godkänn")
    const rowApproveBtn = screen.getByRole('button', { name: 'Godkänn' })
    fireEvent.click(rowApproveBtn)

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          standIds: ['s-conf'],
          decision: 'approve',
          blockSaleId: 'bs-001',
        }),
      )
    })
  })
})
