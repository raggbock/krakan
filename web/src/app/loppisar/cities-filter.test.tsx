import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { CitiesFilter } from './cities-filter'

// FollowButton uses hooks that touch supabase/auth — stub it out so the
// component tests stay focused on the filter logic.
vi.mock('@/components/follow-button', () => ({
  FollowButton: () => <span data-testid="follow-btn" />,
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

function mkCity(name: string, marketCount: number, slug?: string) {
  return { canonicalName: name, marketCount, slug: slug ?? name.toLowerCase() }
}

describe('CitiesFilter', () => {
  const cities = [
    mkCity('Stockholm', 47),
    mkCity('Göteborg', 23),
    mkCity('Malmö', 18),
    mkCity('Uppsala', 9),
    mkCity('Örebro', 5),
    mkCity('Gnosjö', 2),
  ]

  it('renders all cities by default', () => {
    render(<CitiesFilter cities={cities} />)
    for (const c of cities) {
      expect(screen.getByText(c.canonicalName)).toBeInTheDocument()
    }
  })

  it('shows the total match count', () => {
    render(<CitiesFilter cities={cities} />)
    expect(screen.getByText(/6 av 6 städer/)).toBeInTheDocument()
  })

  it('filters by typed query (canonical name)', () => {
    render(<CitiesFilter cities={cities} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'malm' } })
    expect(screen.getByText('Malmö')).toBeInTheDocument()
    expect(screen.queryByText('Stockholm')).not.toBeInTheDocument()
    expect(screen.getByText(/1 av 6 städer/)).toBeInTheDocument()
  })

  it('filters by slug', () => {
    render(<CitiesFilter cities={[mkCity('Östersund', 4, 'ostersund')]} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ostersund' } })
    expect(screen.getByText('Östersund')).toBeInTheDocument()
  })

  it('filters by minimum market count via chips', () => {
    render(<CitiesFilter cities={cities} />)
    fireEvent.click(screen.getByRole('button', { name: '10+' }))
    expect(screen.getByText('Stockholm')).toBeInTheDocument()
    expect(screen.getByText('Göteborg')).toBeInTheDocument()
    expect(screen.getByText('Malmö')).toBeInTheDocument()
    expect(screen.queryByText('Uppsala')).not.toBeInTheDocument()
    expect(screen.queryByText('Gnosjö')).not.toBeInTheDocument()
  })

  it('combines query + min-count filters', () => {
    render(<CitiesFilter cities={cities} />)
    fireEvent.click(screen.getByRole('button', { name: '20+' }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'stock' } })
    expect(screen.getByText('Stockholm')).toBeInTheDocument()
    expect(screen.queryByText('Göteborg')).not.toBeInTheDocument()
  })

  it('shows an empty-state message when no city matches', () => {
    render(<CitiesFilter cities={cities} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'qzx' } })
    expect(screen.getByText(/Inga städer matchar/)).toBeInTheDocument()
  })

  it('pluralises market count correctly', () => {
    render(<CitiesFilter cities={[mkCity('Singel', 1), mkCity('Flera', 3)]} />)
    expect(screen.getByText('1 loppis')).toBeInTheDocument()
    expect(screen.getByText('3 loppisar')).toBeInTheDocument()
  })
})
