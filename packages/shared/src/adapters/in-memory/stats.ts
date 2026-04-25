import type { StatsPort } from '../../ports/stats'

/**
 * In-memory StatsPort. Returns empty arrays by default — the in-memory
 * stores don't carry the SQL-side aggregations the production RPCs compute.
 * Tests that need specific stats can override the methods on the test double.
 */
export function createInMemoryStats(): StatsPort {
  return {
    async organizerBookingStats() { return [] },
    async organizerRouteStats() { return [] },
  }
}
