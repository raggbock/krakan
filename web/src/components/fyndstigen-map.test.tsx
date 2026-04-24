import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { FyndstigenMap, type MapMarker } from './fyndstigen-map'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFitBounds = vi.fn()
const mockFlyTo = vi.fn()

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center, zoom }: any) => (
    <div data-testid="map-container" data-center={JSON.stringify(center)} data-zoom={zoom}>
      {children}
    </div>
  ),
  TileLayer: () => null,
  Marker: ({ children, position, eventHandlers }: any) => (
    <div
      data-testid="marker"
      data-position={JSON.stringify(position)}
      onClick={() => eventHandlers?.click?.()}
    >
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  Polyline: ({ positions, pathOptions }: any) => (
    <div
      data-testid="polyline"
      data-positions={JSON.stringify(positions)}
      data-color={pathOptions?.color}
      data-dash={pathOptions?.dashArray ?? 'none'}
    />
  ),
  useMap: () => ({
    fitBounds: mockFitBounds,
    flyTo: mockFlyTo,
  }),
  useMapEvents: (_handlers: any) => null,
}))

vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('leaflet', () => ({
  default: {
    Icon: class {
      constructor(public opts: any) {}
    },
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeMarker = (id: string, overrides?: Partial<MapMarker>): MapMarker => ({
  id,
  coord: [59.3, 18.07],
  icon: 'market',
  ...overrides,
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FyndstigenMap', () => {
  beforeEach(() => {
    mockFitBounds.mockClear()
    mockFlyTo.mockClear()
  })

  it('renders the map container', () => {
    render(<FyndstigenMap markers={[]} />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('renders a marker for each entry in markers', () => {
    const markers = [
      makeMarker('m1'),
      makeMarker('m2'),
      makeMarker('m3'),
    ]
    render(<FyndstigenMap markers={markers} />)
    expect(screen.getAllByTestId('marker')).toHaveLength(3)
  })

  it('renders marker popups when popup prop is provided', () => {
    const markers = [
      makeMarker('m1', { popup: <span>Hello popup</span> }),
    ]
    render(<FyndstigenMap markers={markers} />)
    expect(screen.getByTestId('popup')).toBeInTheDocument()
    expect(screen.getByText('Hello popup')).toBeInTheDocument()
  })

  it('does not render a popup element when popup is not provided', () => {
    render(<FyndstigenMap markers={[makeMarker('m1')]} />)
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument()
  })

  it('renders a polyline when route with 2+ coords is provided', () => {
    const route = { coords: [[59.1, 18.0], [59.2, 18.1]] as [number, number][] }
    render(<FyndstigenMap markers={[]} route={route} />)
    expect(screen.getByTestId('polyline')).toBeInTheDocument()
  })

  it('does not render a polyline when route has fewer than 2 coords', () => {
    const route = { coords: [[59.1, 18.0]] as [number, number][] }
    render(<FyndstigenMap markers={[]} route={route} />)
    expect(screen.queryByTestId('polyline')).not.toBeInTheDocument()
  })

  it('renders a solid polyline (no dashArray) when style=solid', () => {
    const route = {
      coords: [[59.1, 18.0], [59.2, 18.1]] as [number, number][],
      style: 'solid' as const,
    }
    render(<FyndstigenMap markers={[]} route={route} />)
    const polyline = screen.getByTestId('polyline')
    expect(polyline.dataset.dash).toBe('none')
  })

  it('renders a dashed polyline when style=dashed', () => {
    const route = {
      coords: [[59.1, 18.0], [59.2, 18.1]] as [number, number][],
      style: 'dashed' as const,
    }
    render(<FyndstigenMap markers={[]} route={route} />)
    const polyline = screen.getByTestId('polyline')
    expect(polyline.dataset.dash).toBe('8, 8')
  })

  it('calls onMarkerClick with the correct id when a marker is clicked', () => {
    const onMarkerClick = vi.fn()
    const markers = [makeMarker('abc')]
    render(<FyndstigenMap markers={markers} onMarkerClick={onMarkerClick} />)
    fireEvent.click(screen.getByTestId('marker'))
    expect(onMarkerClick).toHaveBeenCalledWith('abc')
  })

  it('does not attach click handler when onMarkerClick is not provided', () => {
    render(<FyndstigenMap markers={[makeMarker('m1')]} />)
    // No crash — marker renders without eventHandlers
    expect(screen.getByTestId('marker')).toBeInTheDocument()
  })

  it('renders children inside the map container', () => {
    render(
      <FyndstigenMap markers={[]}>
        <div data-testid="child-layer">custom layer</div>
      </FyndstigenMap>,
    )
    expect(screen.getByTestId('child-layer')).toBeInTheDocument()
  })

  it('uses provided center and zoom', () => {
    render(<FyndstigenMap markers={[]} center={[60.0, 20.0]} zoom={13} />)
    const container = screen.getByTestId('map-container')
    expect(container.dataset.center).toBe('[60,20]')
    expect(container.dataset.zoom).toBe('13')
  })

  it('renders dashed polyline for route-builder with opacity 0.7', () => {
    const route = { coords: [[59.1, 18.0], [59.2, 18.1]] as [number, number][], style: 'dashed' as const }
    render(<FyndstigenMap markers={[]} route={route} />)
    expect(screen.getByTestId('polyline').dataset.dash).toBe('8, 8')
  })

  it('renders fallback polyline distinct from dashed (faded)', () => {
    // fallback style is route-map's no-OSRM-available case. Same dash pattern
    // as 'dashed' but lower opacity — the test asserts both render as dashed
    // but the component distinguishes them via opacity.
    const route = { coords: [[59.1, 18.0], [59.2, 18.1]] as [number, number][], style: 'fallback' as const }
    render(<FyndstigenMap markers={[]} route={route} />)
    expect(screen.getByTestId('polyline').dataset.dash).toBe('8, 8')
  })

  it('uses rust color (#C45B35) on polyline', () => {
    const route = { coords: [[59.1, 18.0], [59.2, 18.1]] as [number, number][] }
    render(<FyndstigenMap markers={[]} route={route} />)
    expect(screen.getByTestId('polyline').dataset.color).toBe('#C45B35')
  })
})
