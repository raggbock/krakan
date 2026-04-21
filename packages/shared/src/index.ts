// API
export { createApi } from './api'
export type { Api, CreateApiOptions } from './api'
export { createImageService } from './api/images'
export type { ImageService, ImageServiceDeps } from './api/images'
export { createEdgeClient } from './api/edge'
export type { EdgeClient } from './api/edge'
export { createEndpointsApi } from './api/endpoints'
export type { EndpointsApi } from './api/endpoints'

// Contracts
export { BookingCreateInput, BookingCreateOutput } from './contracts/booking-create'

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
export { applyBookingEvent } from './booking-lifecycle'
export type { BookingEvent, BookingPatch } from './booking-lifecycle'

// Ports
export * from './ports'

// Adapters
export { createSupabaseAdapters, createSupabaseAuth, createSupabaseServerData } from './adapters'
export { createInMemoryAuth, createInMemoryServerData } from './adapters/in-memory'

// Geo
export { createGeo, GeocodeError } from './geo'
export type { LatLng, GeoService, GeoOptions } from './geo'

// Errors
export { appError, isAppError } from './errors'
export type { AppError, ErrorCode } from './errors'

// Utilities
export { checkOpeningHours, getUpcomingOpenDates } from './opening-hours'
export type { OpeningHoursResult, UpcomingDate, TimeSlot } from './opening-hours'
export { optimizeRoute } from './route-optimizer'
export type { Stop } from './route-optimizer'
export { formatDistance, formatDuration, fetchDrivingRoute } from './routing'
export type { RoutingResult, RouteLeg } from './routing'
export { getInitials, slugifyCity } from './format'
