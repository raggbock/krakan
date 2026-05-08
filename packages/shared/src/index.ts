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
  decideCreateBooking,
} from './domain/booking'
export type { CreateBookingInput, CreateBookingDecision } from './domain/booking'
export { applyBookingEvent } from './domain/booking-lifecycle'
export type { BookingEvent, BookingPatch } from './domain/booking-lifecycle'
export { createBookingService } from './domain/booking-service'
export type {
  BookingService,
  BookingServiceApi,
  CreateBookingParams,
  BookRequestParams,
  BookSubmitInput,
  BookingProgress,
  BookOptions,
  DateValidation,
} from './domain/booking-service'
export type { OpeningHoursContext, BookingDateValidation } from './domain/booking'

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
export { createInMemoryBookingRepo } from './adapters/in-memory/booking-repo'
export type { InMemoryBookingRepo } from './adapters/in-memory/booking-repo'
export { createInMemoryStripeAccountRepo } from './adapters/in-memory/stripe-account-repo'
export type { InMemoryStripeAccountRepo } from './adapters/in-memory/stripe-account-repo'
export { createInMemorySubscriptionRepo } from './adapters/in-memory/subscription-repo'
export type { InMemorySubscriptionRepo } from './adapters/in-memory/subscription-repo'

// Geo
export { createGeo, GeocodeError } from './geo'
export type { LatLng, GeoService, GeoOptions } from './geo'

// Errors
export { appError, isAppError, toAppError, messageFor, interpolate } from './errors'
export type { AppError, ErrorCode, ErrorParams, ParamsFor } from './errors'

// Market mutation saga
export { runMarketMutation, collectMarketEvents } from './domain/market-mutation'
export type {
  MarketPlan,
  MarketEvent,
  MarketPhase,
  MarketMutationDeps,
  MarketMutationGeo,
  MarketDeps,
  MarketPlanTableDraft,
  MarketPlanRuleDraft,
  MarketPlanExceptionDraft,
  MarketPlanAddress,
  MarketCreateFields,
  MarketUpdateFields,
  RuleDraft,
  ExceptionDraft,
} from './domain/market-mutation'

// Route mutation saga
export { runRouteMutation, collectRouteEvents } from './domain/route-mutation'
export type {
  RoutePlan,
  RouteEvent,
  RoutePhase,
  RouteDeps,
  RouteMutationApi,
  StopDraft,
  RouteCreateFields,
  RouteUpdateFields,
} from './domain/route-mutation'

// Deps container
export type { Deps } from './deps'
// makeInMemoryDeps + makeSupabaseDeps live at @fyndstigen/shared/deps-factory
// so tree-shakers can skip Supabase adapter graph when only domain logic is needed.

// Stripe webhook reducer
export { interpretWebhookEvent } from './stripe-webhook'
export type { WebhookCommand, WebhookLookups, InterpretInput } from './stripe-webhook'

// Utilities
export { checkOpeningHours, getUpcomingOpenDates } from './domain/opening-hours'
export type { OpeningHoursResult, UpcomingDate, TimeSlot } from './domain/opening-hours'
export { optimizeRoute } from './domain/route-optimizer'
export type { Stop } from './domain/route-optimizer'
export { fetchDrivingRoute } from './geo/routing'
export type { RoutingResult, RouteLeg } from './geo/routing'
export { getInitials, slugifyCity, formatDistance, formatDuration } from './format'
