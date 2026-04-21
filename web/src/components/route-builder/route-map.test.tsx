import React from 'react'
import { render } from '@testing-library/react'
import { RouteMap } from './route-map'

// Leaflet and react-leaflet don't work in jsdom — mock the map primitives
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: any) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: any) => <div>{children}</div>,
  Polyline: () => <div data-testid="polyline" />,
  useMapEvents: (_handlers: any) => null,
}))

vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('@/lib/map-markers', () => ({
  inactiveMarkerIcon: {},
  numberedMarkerIcon: (_n: number) => ({}),
  startPointIcon: {},
}))

const defaultProps = {
  markets: [],
  stops: [],
  onToggleMarket: vi.fn(),
  isInRoute: (_id: string) => false,
  useGps: true,
  customStart: null,
  onCustomStartChange: vi.fn(),
}

describe('RouteMap (smoke)', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(<RouteMap {...defaultProps} />)
    expect(getByTestId('map-container')).toBeInTheDocument()
  })

  it('renders a marker for each market', () => {
    const markets = [
      { id: 'm1', name: 'Loppis 1', city: 'Stad', latitude: 59.1, longitude: 15.1 } as any,
      { id: 'm2', name: 'Loppis 2', city: 'Stad', latitude: 59.2, longitude: 15.2 } as any,
    ]
    const { getAllByTestId } = render(<RouteMap {...defaultProps} markets={markets} />)
    expect(getAllByTestId('marker')).toHaveLength(2)
  })

  it('renders a polyline when 2+ stops are present', () => {
    const market = { id: 'm1', name: 'L', city: 'C', latitude: 59.0, longitude: 15.0 } as any
    const market2 = { id: 'm2', name: 'L2', city: 'C', latitude: 59.1, longitude: 15.1 } as any
    const stops = [
      { market, index: 0 },
      { market: market2, index: 1 },
    ]
    const { getByTestId } = render(<RouteMap {...defaultProps} stops={stops} />)
    expect(getByTestId('polyline')).toBeInTheDocument()
  })
})
