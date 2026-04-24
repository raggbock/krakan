/**
 * MarketMutation — declarative saga for saving a flea market.
 *
 * Replaces two divergent imperative orchestrators (the create hook and the
 * edit page's handleSubmit) with a single event-emitting generator driven
 * by a declarative plan.
 *
 * Dependency strategy: ports & adapters. The generator doesn't know about
 * Supabase, React or Next.js — it calls injected `api` / `geo` methods
 * and yields `MarketEvent` values. Tests drive it with in-memory stubs.
 *
 * See RFC #19.
 */

import type {
  CreateFleaMarketPayload,
  UpdateFleaMarketPayload,
  CreateMarketTablePayload,
  FleaMarketImage,
} from './types'
import { GeocodeError } from './geo'
import { appError, isAppError, type AppError } from './errors'

// ---------- Draft types (owned here; shared with web hooks) ----------

/** A draft rule before it has been persisted to the DB. */
export type RuleDraft = {
  type: 'weekly' | 'biweekly' | 'date'
  dayOfWeek: number | null
  anchorDate: string | null
  openTime: string
  closeTime: string
}

/** A draft exception (closed day) before it has been persisted to the DB. */
export type ExceptionDraft = {
  date: string
  reason: string | null
}

// ---------- Plan shape ----------

export type MarketPlanTableDraft = {
  label: string
  description?: string
  priceSek: number
  sizeDescription?: string
}

export type MarketPlanRuleDraft = {
  type: 'weekly' | 'biweekly' | 'date'
  dayOfWeek: number | null
  anchorDate: string | null
  openTime: string
  closeTime: string
}

export type MarketPlanExceptionDraft = {
  date: string
  reason: string | null
}

/** Address bits that may need geocoding. If coordinates are present we skip geocoding. */
export type MarketPlanAddress = {
  street: string
  zipCode: string
  city: string
  country?: string
  coordinates?: { latitude: number; longitude: number }
}

/** Fields used to build CreateFleaMarketPayload on create-new-market. */
export type MarketCreateFields = {
  name: string
  description: string
  address: MarketPlanAddress
  isPermanent: boolean
  organizerId: string
  autoAcceptBookings?: boolean
}

/** Fields used to build UpdateFleaMarketPayload on edit. */
export type MarketUpdateFields = {
  name: string
  description: string
  address: MarketPlanAddress
  isPermanent: boolean
  /** If true the market is already published — skip the publish phase. */
  alreadyPublished: boolean
}

export type MarketPlan = {
  market:
    | { create: MarketCreateFields }
    | { update: { id: string; patch: MarketUpdateFields } }
  images: { add: File[]; remove: FleaMarketImage[] }
  tables: { add: MarketPlanTableDraft[]; remove: string[] }
  opening: { rules: MarketPlanRuleDraft[]; exceptions: MarketPlanExceptionDraft[] }
}

// ---------- Event shape ----------

export type MarketPhase =
  | 'geocoding'
  | 'saving_market'
  | 'publishing'
  | 'saving_tables'
  | 'saving_images'

export type MarketEvent =
  // Phase start (may carry the resolved marketId once known)
  | { phase: MarketPhase; status: 'start' }
  // Phase done (non-item phases: geocoding, saving_market, publishing)
  | { phase: 'geocoding'; status: 'ok'; coordinates: { latitude: number; longitude: number } }
  | { phase: 'saving_market'; status: 'ok'; marketId: string }
  | { phase: 'publishing'; status: 'ok' }
  | { phase: 'publishing'; status: 'skipped' }
  | { phase: 'geocoding'; status: 'skipped' }
  // Per-item events inside the tables and images phases
  | { phase: 'saving_tables'; status: 'item_ok'; kind: 'add'; index: number; tableId: string }
  | { phase: 'saving_tables'; status: 'item_ok'; kind: 'remove'; index: number; tableId: string }
  | { phase: 'saving_tables'; status: 'item_error'; kind: 'add'; index: number; error: AppError }
  | { phase: 'saving_tables'; status: 'item_error'; kind: 'remove'; index: number; tableId: string; error: AppError }
  | { phase: 'saving_tables'; status: 'done' }
  | { phase: 'saving_images'; status: 'item_start'; kind: 'add'; index: number; file: File }
  | { phase: 'saving_images'; status: 'item_ok'; kind: 'add'; index: number; file: File }
  | { phase: 'saving_images'; status: 'item_ok'; kind: 'remove'; index: number; imageId: string }
  | { phase: 'saving_images'; status: 'item_error'; kind: 'add'; index: number; file: File; error: AppError }
  | { phase: 'saving_images'; status: 'item_error'; kind: 'remove'; index: number; imageId: string; error: AppError }
  | { phase: 'saving_images'; status: 'done' }
  // Terminal events
  | { type: 'complete'; marketId: string }
  | { type: 'failed'; error: AppError }

// ---------- Deps ----------

/**
 * Subset of the `Api` surface the saga actually needs. Narrowing the type
 * here (rather than pulling in the full `Api`) keeps the shared package
 * free of the full Supabase-backed factory and lets tests stub just these
 * methods.
 */
export type MarketMutationApi = {
  fleaMarkets: {
    create(payload: CreateFleaMarketPayload): Promise<{ id: string }>
    update(id: string, payload: UpdateFleaMarketPayload): Promise<void>
    publish(id: string): Promise<void>
  }
  marketTables: {
    create(payload: CreateMarketTablePayload): Promise<{ id: string }>
    delete(id: string): Promise<void>
  }
  images: {
    add(marketId: string, file: File): Promise<FleaMarketImage>
    remove(image: FleaMarketImage): Promise<void>
  }
}

export type MarketMutationGeo = {
  geocode(address: string): Promise<{ lat: number; lng: number }>
}

export type MarketDeps = {
  api: MarketMutationApi
  geo: MarketMutationGeo
  now?: () => Date
}

// ---------- Saga ----------

function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err
  if (err instanceof GeocodeError) {
    return appError('geocode.not_found', { message: err.message })
  }
  if (err instanceof Error) {
    return appError('unknown', { message: err.message })
  }
  return appError('unknown')
}

function buildAddressString(a: MarketPlanAddress): string {
  return `${a.street.trim()}, ${a.zipCode.trim()} ${a.city.trim()}, ${a.country ?? 'Sweden'}`
}

export async function* runMarketMutation(
  plan: MarketPlan,
  deps: MarketDeps,
): AsyncGenerator<MarketEvent, void, void> {
  const { api, geo } = deps

  // Grab the address + whether this is an edit up-front.
  const isCreate = 'create' in plan.market
  const fields = isCreate
    ? (plan.market as { create: MarketCreateFields }).create
    : (plan.market as { update: { id: string; patch: MarketUpdateFields } }).update.patch

  // ---------- 1. Geocoding ----------
  let latitude: number
  let longitude: number
  const pre = fields.address.coordinates
  if (pre && typeof pre.latitude === 'number' && typeof pre.longitude === 'number') {
    yield { phase: 'geocoding', status: 'skipped' }
    latitude = pre.latitude
    longitude = pre.longitude
  } else {
    yield { phase: 'geocoding', status: 'start' }
    try {
      const coords = await geo.geocode(buildAddressString(fields.address))
      latitude = coords.lat
      longitude = coords.lng
      yield { phase: 'geocoding', status: 'ok', coordinates: { latitude, longitude } }
    } catch (err) {
      yield { type: 'failed', error: toAppError(err) }
      return
    }
  }

  // ---------- 2. Save market (create or update) ----------
  yield { phase: 'saving_market', status: 'start' }
  let marketId: string
  try {
    if (isCreate) {
      const f = fields as MarketCreateFields
      const { id } = await api.fleaMarkets.create({
        name: f.name.trim(),
        description: f.description.trim(),
        address: {
          street: f.address.street.trim(),
          zipCode: f.address.zipCode.trim(),
          city: f.address.city.trim(),
          country: f.address.country ?? 'Sweden',
          location: { latitude, longitude },
        },
        isPermanent: f.isPermanent,
        organizerId: f.organizerId,
        autoAcceptBookings: f.autoAcceptBookings,
        openingHours: plan.opening.rules,
        openingHourExceptions: plan.opening.exceptions,
      })
      marketId = id
    } else {
      const { id, patch } = (plan.market as { update: { id: string; patch: MarketUpdateFields } }).update
      await api.fleaMarkets.update(id, {
        name: patch.name.trim(),
        description: patch.description.trim(),
        address: {
          street: patch.address.street.trim(),
          zipCode: patch.address.zipCode.trim(),
          city: patch.address.city.trim(),
          country: patch.address.country ?? 'Sweden',
          location: { latitude, longitude },
        },
        isPermanent: patch.isPermanent,
        openingHours: plan.opening.rules,
        openingHourExceptions: plan.opening.exceptions,
      })
      marketId = id
    }
    yield { phase: 'saving_market', status: 'ok', marketId }
  } catch (err) {
    yield { type: 'failed', error: toAppError(err) }
    return
  }

  // ---------- 3. Publish (new markets only, or unpublished edits) ----------
  const shouldPublish = isCreate
    ? true
    : !(fields as MarketUpdateFields).alreadyPublished
  if (shouldPublish) {
    yield { phase: 'publishing', status: 'start' }
    try {
      await api.fleaMarkets.publish(marketId)
      yield { phase: 'publishing', status: 'ok' }
    } catch (err) {
      yield { type: 'failed', error: toAppError(err) }
      return
    }
  } else {
    yield { phase: 'publishing', status: 'skipped' }
  }

  // ---------- 4. Tables (removes first, then adds) ----------
  // Removes before adds: if the user is renaming/replacing tables, removing
  // the stale row first avoids transient duplicate-label states visible to
  // concurrent readers. Unknown ids yield item_error (the caller may choose
  // to show or swallow) rather than being silently ignored — silent failure
  // hides bugs.
  yield { phase: 'saving_tables', status: 'start' }
  for (let i = 0; i < plan.tables.remove.length; i++) {
    const tableId = plan.tables.remove[i]
    try {
      await api.marketTables.delete(tableId)
      yield { phase: 'saving_tables', status: 'item_ok', kind: 'remove', index: i, tableId }
    } catch (err) {
      yield {
        phase: 'saving_tables',
        status: 'item_error',
        kind: 'remove',
        index: i,
        tableId,
        error: toAppError(err),
      }
    }
  }
  for (let i = 0; i < plan.tables.add.length; i++) {
    const t = plan.tables.add[i]
    try {
      const { id } = await api.marketTables.create({
        fleaMarketId: marketId,
        label: t.label,
        description: t.description || undefined,
        priceSek: t.priceSek,
        sizeDescription: t.sizeDescription || undefined,
      })
      yield { phase: 'saving_tables', status: 'item_ok', kind: 'add', index: i, tableId: id }
    } catch (err) {
      yield {
        phase: 'saving_tables',
        status: 'item_error',
        kind: 'add',
        index: i,
        error: toAppError(err),
      }
    }
  }
  yield { phase: 'saving_tables', status: 'done' }

  // ---------- 5. Images (removes first, then adds) ----------
  yield { phase: 'saving_images', status: 'start' }
  for (let i = 0; i < plan.images.remove.length; i++) {
    const img = plan.images.remove[i]
    try {
      await api.images.remove(img)
      yield { phase: 'saving_images', status: 'item_ok', kind: 'remove', index: i, imageId: img.id }
    } catch (err) {
      yield {
        phase: 'saving_images',
        status: 'item_error',
        kind: 'remove',
        index: i,
        imageId: img.id,
        error: toAppError(err),
      }
    }
  }
  for (let i = 0; i < plan.images.add.length; i++) {
    const file = plan.images.add[i]
    yield { phase: 'saving_images', status: 'item_start', kind: 'add', index: i, file }
    try {
      await api.images.add(marketId, file)
      yield { phase: 'saving_images', status: 'item_ok', kind: 'add', index: i, file }
    } catch (err) {
      yield {
        phase: 'saving_images',
        status: 'item_error',
        kind: 'add',
        index: i,
        file,
        error: toAppError(err),
      }
    }
  }
  yield { phase: 'saving_images', status: 'done' }

  // ---------- Complete ----------
  yield { type: 'complete', marketId }
}

/**
 * Convenience helper used by hook consumers that want to drain the generator
 * into an event array (e.g. for tests or snapshot logging). Production UI
 * code should iterate with `for await` so it can reflect progress.
 */
export async function collectMarketEvents(
  plan: MarketPlan,
  deps: MarketDeps,
): Promise<MarketEvent[]> {
  const events: MarketEvent[] = []
  for await (const ev of runMarketMutation(plan, deps)) events.push(ev)
  return events
}
