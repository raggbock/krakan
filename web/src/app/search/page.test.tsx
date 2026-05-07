import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/hooks/use-search', () => ({ useSearch: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }))
vi.mock('@/components/fyndstigen-logo', () => ({ FyndstigenLogo: () => <div data-testid="loading" /> }))
vi.mock('@fyndstigen/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@fyndstigen/shared')
  return actual
})

import SearchPage from './page'
import { useSearch } from '@/hooks/use-search'

const mockResults = [
  { id: 'm1', name: 'Stortorget', city: 'Stockholm', is_permanent: true },
  { id: 'm2', name: 'Haga Loppis', city: 'Göteborg', is_permanent: false },
]

function setupSearch({
  query = '',
  results = null as typeof mockResults | null,
  loading = false,
  search = vi.fn(),
} = {}) {
  vi.mocked(useSearch).mockReturnValue({ query, results, loading, search } as ReturnType<typeof useSearch>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SearchPage', () => {
  it('shows idle state initially — "Börja skriva för att söka"', () => {
    setupSearch({ results: null, loading: false })
    render(<SearchPage />)
    expect(screen.getByText(/Börja skriva för att söka/)).toBeInTheDocument()
  })

  it('shows loading state during search', () => {
    setupSearch({ loading: true, results: null })
    render(<SearchPage />)
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('shows results with market names and cities', () => {
    setupSearch({ results: mockResults, loading: false })
    render(<SearchPage />)
    expect(screen.getByText('Stortorget')).toBeInTheDocument()
    expect(screen.getByText('Stockholm')).toBeInTheDocument()
    expect(screen.getByText('Haga Loppis')).toBeInTheDocument()
    expect(screen.getByText('Göteborg')).toBeInTheDocument()
  })

  it('shows empty state — "Inga loppisar hittades"', () => {
    setupSearch({ results: [], loading: false })
    render(<SearchPage />)
    expect(screen.getByText('Inga loppisar hittades')).toBeInTheDocument()
  })

  it('search input calls search function on change', () => {
    const mockSearch = vi.fn()
    setupSearch({ results: null, loading: false, search: mockSearch })
    render(<SearchPage />)
    const input = screen.getByPlaceholderText('Skriv namn på en loppis...')
    fireEvent.change(input, { target: { value: 'Stockholm' } })
    expect(mockSearch).toHaveBeenCalledWith('Stockholm')
  })
})
