// API
export { createApi } from './api'
export type { Api, CreateApiOptions } from './api'
export { createImageService } from './api/images'
export type { ImageService, ImageServiceDeps } from './api/images'
export { createEdgeClient } from './api/edge'
export type { EdgeClient } from './api/edge'
export { createEndpointInvokers, ENDPOINTS } from './api/endpoints'
export type { EndpointInvokers, EndpointKey } from './api/endpoints'

// Contracts
export { BookingCreateInput, BookingCreateOutput } from './contracts/booking-create'
export { StripePaymentCaptureInput, StripePaymentCaptureOutput } from './contracts/stripe-payment-capture'

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
export { createBookingService } from './booking-service'
export type { BookingService, CreateBookingParams, BookRequestParams, DateValidation } from './booking-service'
export type { OpeningHoursContext, BookingDateValidation } from './booking'

// Ports
export * from './ports'

// Adapters
export {
  createSupabaseAdapters,
  createSupabaseAuth,
  createSupabaseServerData,
  createSupabaseFleaMarkets,
  createSupabaseSearch,
  createSupabaseMarketTables,
  createSupabaseBookings,
  createSupabaseRoutes,
  createSupabaseProfiles,
  createSupabaseOrganizers,
} from './adapters'
export { createInMemoryAuth, createInMemoryServerData, createInMemoryStack } from './adapters/in-memory'
export { createInMemoryFleaMarkets, createInMemorySearch, createInMemoryMarketTables } from './adapters/in-memory/flea-markets'
export { createInMemoryBookings } from './adapters/in-memory/bookings'
export { createInMemoryRoutes } from './adapters/in-memory/routes'
export { createInMemoryProfiles, createInMemoryOrganizers } from './adapters/in-memory/profiles'

// Geo
export { createGeo, GeocodeError } from './geo'
export type { LatLng, GeoService, GeoOptions } from './geo'

// Errors
export { appError, isAppError, toAppError, messageFor, interpolate } from './errors'
export type { AppError, ErrorCode } from './errors'

// Market mutation saga
export { runMarketMutation, collectMarketEvents } from './market-mutation'
export type {
  MarketPlan,
  MarketEvent,
  MarketPhase,
  MarketDeps,
  MarketMutationApi,
  MarketMutationGeo,
  MarketPlanTableDraft,
  MarketPlanRuleDraft,
  MarketPlanExceptionDraft,
  MarketPlanAddress,
  MarketCreateFields,
  MarketUpdateFields,
  RuleDraft,
  ExceptionDraft,
} from './market-mutation'

// Route mutation saga
export { runRouteMutation, collectRouteEvents } from './route-mutation'
export type {
  RoutePlan,
  RouteEvent,
  RoutePhase,
  RouteDeps,
  RouteMutationApi,
  StopDraft,
  RouteCreateFields,
  RouteUpdateFields,
} from './route-mutation'

// Deps container
export type { Deps } from './deps'
// makeInMemoryDeps + makeSupabaseDeps live at @fyndstigen/shared/deps-factory
// so tree-shakers can skip Supabase adapter graph when only domain logic is needed.

// Utilities
export { checkOpeningHours, getUpcomingOpenDates } from './opening-hours'
export type { OpeningHoursResult, UpcomingDate, TimeSlot } from './opening-hours'
export { optimizeRoute } from './route-optimizer'
export type { Stop } from './route-optimizer'
export { formatDistance, formatDuration, fetchDrivingRoute } from './routing'
export type { RoutingResult, RouteLeg } from './routing'
export { getInitials, slugifyCity } from './format'
