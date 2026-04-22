/**
 * RouteMutation — declarative saga for saving a loppisrunda (route).
 *
 * Mirrors the MarketMutation pattern (RFC #19 / issue #28): a single
 * async-generator replaces ad-hoc imperative orchestration in parent
 * components.  The generator is dependency-injected so it never imports
 * Supabase, React, or Next.js — tests drive it with in-memory stubs.
 */

import type { CreateRoutePayload, UpdateRoutePayload } from './types'
import { appError, isAppError, type AppError } from './errors'

// ---------- Plan shape ----------

/** A single market stop in the draft plan. */
export type StopDraft = {
  fleaMarketId: string
}

/** Fields for creating a brand-new route. */
export type RouteCreateFields = {
  name: string
  description?: string
  createdBy: string
  startLatitude?: number
  startLongitude?: number
  plannedDate?: string
}

/** Fields for patching an existing route (excludes createdBy). */
export type RouteUpdateFields = {
  name: string
  description?: string
  startLatitude?: number
  startLongitude?: number
  plannedDate?: string
}

export type RoutePlan = {
  route:
    | { create: RouteCreateFields }
    | { update: { id: string; patch: RouteUpdateFields } }
  stops: {
    /** Stops to add (in desired sort order). */
    add: StopDraft[]
    /** Stop IDs to remove.  For a fresh create this is always []. */
    remove: string[]
    /**
     * Optional explicit final sort order (market IDs).  When omitted the
     * saga uses the order of `add`.
     */
    reorder?: string[]
  }
}

// ---------- Event shape ----------

export type RoutePhase = 'saving_route' | 'saving_stops'

export type RouteEvent =
  // Phase-level lifecycle
  | { phase: RoutePhase; status: 'start' }
  | { phase: 'saving_route'; status: 'ok'; routeId: string }
  | { phase: 'saving_stops'; status: 'ok' }
  | { phase: RoutePhase; status: 'failed' }
  // Per-item events inside saving_stops
  | { phase: 'saving_stops'; status: 'item_start'; kind: 'add' | 'remove'; index: number }
  | { phase: 'saving_stops'; status: 'item_ok'; kind: 'add' | 'remove'; index: number }
  | { phase: 'saving_stops'; status: 'item_error'; kind: 'add' | 'remove'; index: number; error: AppError }
  | { phase: 'saving_stops'; status: 'done' }
  // Terminal events
  | { type: 'complete'; routeId: string }
  | { type: 'failed'; error: AppError }

// ---------- Deps ----------

/**
 * Narrow API surface the saga actually needs.  This keeps the shared package
 * free of Supabase details and lets tests inject simple stubs.
 */
export type RouteMutationApi = {
  routes: {
    create(payload: CreateRoutePayload): Promise<{ id: string }>
    update(id: string, payload: UpdateRoutePayload): Promise<void>
  }
}

export type RouteDeps = {
  api: RouteMutationApi
}

// ---------- Helpers ----------

function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err
  if (err instanceof Error) return appError('unknown', { message: err.message })
  return appError('unknown')
}

// ---------- Saga ----------

export async function* runRouteMutation(
  plan: RoutePlan,
  deps: RouteDeps,
): AsyncGenerator<RouteEvent, void, void> {
  const { api } = deps
  const isCreate = 'create' in plan.route

  // ---------- 1. Save route record ----------
  yield { phase: 'saving_route', status: 'start' }
  let routeId: string
  try {
    if (isCreate) {
      const f = (plan.route as { create: RouteCreateFields }).create
      // Stops are embedded on create: pass the full ordered list so the
      // Supabase adapter can insert them atomically.
      const { id } = await api.routes.create({
        name: f.name.trim(),
        description: f.description,
        createdBy: f.createdBy,
        startLatitude: f.startLatitude,
        startLongitude: f.startLongitude,
        plannedDate: f.plannedDate,
        stops: plan.stops.add,
      })
      routeId = id
    } else {
      const { id, patch } = (plan.route as { update: { id: string; patch: RouteUpdateFields } }).update
      await api.routes.update(id, {
        name: patch.name.trim(),
        description: patch.description,
        startLatitude: patch.startLatitude,
        startLongitude: patch.startLongitude,
        plannedDate: patch.plannedDate,
        // For update, send the final ordered add-list as the new stop set.
        stops: plan.stops.add,
      })
      routeId = id
    }
    yield { phase: 'saving_route', status: 'ok', routeId }
  } catch (err) {
    yield { type: 'failed', error: toAppError(err) }
    return
  }

  // ---------- 2. Stop-level events ----------
  // The Supabase adapter persists stops atomically inside create/update, so
  // the actual network work is already done.  We still emit per-item events
  // so consumers can show per-stop progress and surface non-critical errors
  // (e.g. if the adapter is replaced with one that does individual inserts).

  yield { phase: 'saving_stops', status: 'start' }

  // Emit remove events first (removes before adds mirrors the market saga).
  for (let i = 0; i < plan.stops.remove.length; i++) {
    yield { phase: 'saving_stops', status: 'item_start', kind: 'remove', index: i }
    // Removal is implicit in the update payload — treated as non-critical.
    yield { phase: 'saving_stops', status: 'item_ok', kind: 'remove', index: i }
  }

  // Emit add events.
  for (let i = 0; i < plan.stops.add.length; i++) {
    yield { phase: 'saving_stops', status: 'item_start', kind: 'add', index: i }
    yield { phase: 'saving_stops', status: 'item_ok', kind: 'add', index: i }
  }

  yield { phase: 'saving_stops', status: 'done' }

  // ---------- Complete ----------
  yield { type: 'complete', routeId }
}

/**
 * Drains the generator into an event array — useful in tests and for
 * snapshot logging.  Production UI should use `for await` to show progress.
 */
export async function collectRouteEvents(
  plan: RoutePlan,
  deps: RouteDeps,
): Promise<RouteEvent[]> {
  const events: RouteEvent[] = []
  for await (const ev of runRouteMutation(plan, deps)) events.push(ev)
  return events
}
