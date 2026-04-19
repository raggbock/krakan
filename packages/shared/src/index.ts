// API
export { createApi } from './api'
export type { Api } from './api'

// Types
export * from './types'

// Booking domain
export {
  COMMISSION_RATE,
  calculateCommission,
  calculateStripeAmounts,
  isValidStatusTransition,
  validateBookingDate,
  generateBatchLabels,
  isFreePriced,
  resolveBookingOutcome,
} from './booking'

// Ports
export * from './ports'

// Adapters
export { createSupabaseAdapters, createSupabaseAuth, createSupabaseServerData } from './adapters'
export { createInMemoryAuth, createInMemoryServerData } from './adapters/in-memory'

// Geo
export { createGeo, GeocodeError } from './geo'
export type { LatLng, GeoService, GeoOptions } from './geo'

// Utilities
export { checkOpeningHours, getUpcomingOpenDates } from './opening-hours'
export type { OpeningHoursResult, UpcomingDate, TimeSlot } from './opening-hours'
export { optimizeRoute } from './route-optimizer'
export type { Stop } from './route-optimizer'
export { formatDistance, formatDuration, fetchDrivingRoute } from './routing'
export type { RoutingResult, RouteLeg } from './routing'
export { getInitials } from './format'
