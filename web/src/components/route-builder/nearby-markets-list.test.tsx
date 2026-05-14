import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import type { FleaMarketNearByView } from '@fyndstigen/shared'
import { NearbyMarketsList } from './nearby-markets-list'
import type { RouteBuilderStop } from './stop-list'

function mkMarket(over: Partial<FleaMarketNearByView> = {}): FleaMarketNearByView {
  return {
    id: 'm-' + Math.random().toString(36).slice(2, 8),
    name: 'Loppis',
    description: '',
    city: 'Stad',
    isPermanent: true,
    latitude: 59.0,
    longitude: 18.0,
    distanceKm: 0,
    publishedAt: '2026-01-01',
    ...over,
  }
}

function mkStop(market: FleaMarketNearByView, index = 0): RouteBuilderStop {
  return { market: market as RouteBuilderStop['market'], index }
}

describe('NearbyMarketsList', () => {
  it('renders nothing when there are no markets', () => {
    const { container } = render(
      <NearbyMarketsList markets={[]} stops={[]} userPos={null} onAdd={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('excludes markets already in the route', () => {
    const m1 = mkMarket({ name: 'In Route' })
    const m2 = mkMarket({ name: 'Available' })
    render(
      <NearbyMarketsList
        markets={[m1, m2]}
        stops={[mkStop(m1)]}
        userPos={null}
        onAdd={vi.fn()}
      />,
    )
    expect(screen.queryByText('In Route')).not.toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  it('sorts by distance from userPos when geolocation is available', () => {
    const stockholm = mkMarket({ name: 'Stockholm', latitude: 59.33, longitude: 18.07 })
    const goteborg = mkMarket({ name: 'Göteborg', latitude: 57.71, longitude: 11.97 })
    const malmo = mkMarket({ name: 'Malmö', latitude: 55.61, longitude: 13.0 })
    render(
      <NearbyMarketsList
        markets={[goteborg, malmo, stockholm]}
        stops={[]}
        userPos={{ lat: 59.0, lng: 18.0 }} // Near Stockholm
        onAdd={vi.fn()}
      />,
    )
    const items = screen.getAllByRole('button').map((b) => b.textContent)
    expect(items[0]).toContain('Stockholm')
  })

  it('sorts alphabetically when userPos is null', () => {
    render(
      <NearbyMarketsList
        markets={[
          mkMarket({ name: 'Östermalm' }),
          mkMarket({ name: 'Aspudden' }),
          mkMarket({ name: 'Midsommarkransen' }),
        ]}
        stops={[]}
        userPos={null}
        onAdd={vi.fn()}
      />,
    )
    const items = screen.getAllByRole('button').map((b) => b.textContent)
    expect(items[0]).toContain('Aspudden')
  })

  it('filters by typed query (matches name or city)', () => {
    render(
      <NearbyMarketsList
        markets={[
          mkMarket({ name: 'Erikshjälpen', city: 'Lund' }),
          mkMarket({ name: 'Myrorna', city: 'Stockholm' }),
        ]}
        stops={[]}
        userPos={null}
        onAdd={vi.fn()}
      />,
    )
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'lund' } })
    expect(screen.getByText('Erikshjälpen')).toBeInTheDocument()
    expect(screen.queryByText('Myrorna')).not.toBeInTheDocument()
  })

  it('fires onAdd with the market id when a row is clicked', () => {
    const m = mkMarket({ id: 'abc-123', name: 'Klickbar' })
    const onAdd = vi.fn()
    render(<NearbyMarketsList markets={[m]} stops={[]} userPos={null} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('Klickbar').closest('button')!)
    expect(onAdd).toHaveBeenCalledWith('abc-123')
  })

  it('caps the initial list and expands on "Visa N till"', () => {
    const markets = Array.from({ length: 10 }, (_, i) =>
      mkMarket({ id: `m${i}`, name: `Loppis ${i}` }),
    )
    render(
      <NearbyMarketsList markets={markets} stops={[]} userPos={null} onAdd={vi.fn()} />,
    )
    expect(screen.queryByText('Loppis 7')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/Visa 4 till/))
    expect(screen.getByText('Loppis 7')).toBeInTheDocument()
  })
})
