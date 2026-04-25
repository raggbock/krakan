/**
 * RouteQuery — co-locates select strings, row types, and mappers for the
 * route adapter (RFC #34, mirrors FleaMarketQuery + BookingQuery).
 *
 * Two variants:
 *   - details: route + stops + nested flea_markets (with opening hours) +
 *              creator profile. Used by routes.get(id).
 *   - summary: route + stop ids only (count). Used by routes.listByUser.
 */

import type { RouteWithStops, RouteSummary } from '../types'
import {
  mapRouteWithStops,
  mapRouteSummary,
  type RouteDetailsRow,
  type RouteSummaryRow,
} from '../api/mappers'

export const RouteQuery = {
  details: {
    select: `
      *,
      route_stops (
        id,
        flea_market_id,
        sort_order,
        flea_markets (
          id, name, description, street, zip_code, city, country,
          is_permanent, latitude, longitude,
          opening_hour_rules (*),
          opening_hour_exceptions (*)
        )
      ),
      profiles!routes_created_by_fkey (first_name, last_name)
    ` as const,

    mapRow(row: RouteDetailsRow): RouteWithStops {
      return mapRouteWithStops(row)
    },
  },

  summary: {
    select: '*, route_stops(id)' as const,

    mapRow(row: RouteSummaryRow): RouteSummary {
      return mapRouteSummary(row)
    },
  },
} as const
