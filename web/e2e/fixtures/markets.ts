import type { StoredMarket } from '@fyndstigen/shared/adapters/in-memory/flea-markets'

// Seed markets used by the map E2E suite. Coordinates match the OSRM
// fixture recordings — if you change a coord, regenerate fixtures with
// `npm run e2e:fixtures -- "<coords>"`.
//
// `setNow('2026-04-23T12:00:00Z')` is a Thursday afternoon — all markets
// seeded here are declared permanent + published so they appear in list
// queries regardless of opening hours.

const BASE: Omit<StoredMarket, 'id' | 'name' | 'latitude' | 'longitude' | 'street'> = {
  description: 'E2E seed market',
  zip_code: '41101',
  city: 'Göteborg',
  country: 'SE',
  is_permanent: true,
  published_at: '2024-01-01T00:00:00Z',
  organizer_id: 'u-e2e-organizer',
  auto_accept_bookings: false,
  created_at: '2024-01-01T00:00:00Z',
  is_deleted: false,
  updated_at: '2024-01-01T00:00:00Z',
}

export const gothenburgMarkets: StoredMarket[] = [
  {
    ...BASE,
    id: 'm1',
    name: 'Kungsportsavenyn Loppis',
    street: 'Kungsportsavenyn 1',
    latitude: 57.7015,
    longitude: 11.9719,
  },
  {
    ...BASE,
    id: 'm2',
    name: 'Haga Loppis',
    street: 'Haga Nygata 10',
    latitude: 57.7072,
    longitude: 11.9665,
  },
  {
    ...BASE,
    id: 'm3',
    name: 'Linnéstaden Loppis',
    street: 'Linnégatan 22',
    latitude: 57.6969,
    longitude: 11.9520,
  },
  {
    ...BASE,
    id: 'm4',
    name: 'Gamlestaden Loppis',
    street: 'Gamlestadstorget 1',
    latitude: 57.7100,
    longitude: 11.9850,
  },
  {
    ...BASE,
    id: 'm5',
    name: 'Partille Loppis',
    street: 'Partille Torg 1',
    latitude: 57.7200,
    longitude: 12.0100,
  },
]
