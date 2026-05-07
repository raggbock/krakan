/**
 * Centralized query key definitions for TanStack Query.
 *
 * Convention: each entity has a base key and specific query keys.
 * This ensures cache invalidation hits the right queries.
 */

export const queryKeys = {
  markets: {
    all: ['markets'] as const,
    list: (params?: { page?: number; pageSize?: number }) =>
      [...queryKeys.markets.all, 'list', params] as const,
    byOrganizer: (organizerId: string) =>
      [...queryKeys.markets.all, 'organizer', organizerId] as const,
    details: (id: string) =>
      [...queryKeys.markets.all, 'details', id] as const,
  },
  bookings: {
    all: ['bookings'] as const,
    byMarket: (marketId: string) =>
      [...queryKeys.bookings.all, 'market', marketId] as const,
    byUser: (userId: string) =>
      [...queryKeys.bookings.all, 'user', userId] as const,
    availableDates: (tableId: string) =>
      [...queryKeys.bookings.all, 'dates', tableId] as const,
  },
  routes: {
    all: ['routes'] as const,
    byUser: (userId: string) =>
      [...queryKeys.routes.all, 'user', userId] as const,
    details: (id: string) =>
      [...queryKeys.routes.all, 'details', id] as const,
    popular: () =>
      [...queryKeys.routes.all, 'popular'] as const,
  },
  organizers: {
    all: ['organizers'] as const,
    byId: (id: string) =>
      ['organizers', 'detail', id] as const,
    stats: (organizerId: string) =>
      ['organizers', 'stats', organizerId] as const,
  },
  admin: {
    all: ['admin'] as const,
    takeoverPending: () => ['admin', 'takeover', 'pending'] as const,
    actions: () => ['admin', 'actions'] as const,
    socialWeekend: () => ['admin', 'social', 'weekend-markets'] as const,
    marketsOverview: () => ['admin', 'markets', 'overview'] as const,
    marketActivity: (marketId: string | null) =>
      ['admin', 'markets', 'activity', marketId] as const,
  },
  takeover: {
    info: (token: string | null) => ['takeover', 'info', token] as const,
  },
  stripeConnect: {
    status: (userId: string | undefined) =>
      ['stripe-connect', 'status', userId] as const,
  },
  blockSales: {
    all: () => ['blockSales'] as const,
    bySlug: (slug: string) => ['blockSales', 'slug', slug] as const,
    queue: (slug: string) => ['blockSales', 'queue', slug] as const,
  },
}
