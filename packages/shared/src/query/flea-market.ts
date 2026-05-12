/**
 * FleaMarketQuery — owns the select string, row type, and mapper for each query shape.
 *
 * Row types are hand-written compositions of generated base table types from
 * supabase.generated.ts. Do not use Record<string, unknown> here — the point is
 * that column renames surface as TypeScript errors in the mapper, not runtime crashes.
 *
 * To add a new variant: add a new key with { select, mapRow }.
 * Adapters destructure the variant they need; no inline select strings in adapters.
 */

import type { Database } from '../types/supabase.generated'
import type { FleaMarketDetailsView, RuleType } from '../types'
import { formatName } from '../api/mappers'

// --- Base table row types (from generated types) ---

type FleaMarketTableRow = Database['public']['Tables']['flea_markets']['Row']
type OpeningHourRuleTableRow = Database['public']['Tables']['opening_hour_rules']['Row']
type OpeningHourExceptionTableRow = Database['public']['Tables']['opening_hour_exceptions']['Row']
type FleaMarketImageTableRow = Database['public']['Tables']['flea_market_images']['Row']
type ProfileTableRow = Database['public']['Tables']['profiles']['Row']

// --- Hand-written row types (composed from generated base types) ---

/**
 * Shape returned by the `details` select — flea_markets joined with all related tables.
 * The joined arrays and the organizer profile come from the select string below.
 */
export type FleaMarketDetailsRow = FleaMarketTableRow & {
  opening_hour_rules: OpeningHourRuleTableRow[]
  opening_hour_exceptions: OpeningHourExceptionTableRow[]
  flea_market_images: FleaMarketImageTableRow[]
  profiles: Pick<ProfileTableRow, 'first_name' | 'last_name' | 'subscription_tier'> | null
}

// --- Query module ---

export const FleaMarketQuery = {
  /**
   * Fetch a single market's full details, including opening hours, exceptions,
   * images, and the organizer's display name.
   *
   * The select string matches what the adapter used inline before this module existed —
   * no new network calls, no N+1 introduced.
   */
  details: {
    select: `
      *,
      opening_hour_rules (*),
      opening_hour_exceptions (*),
      flea_market_images (*),
      profiles!flea_markets_organizer_id_fkey (first_name, last_name, subscription_tier)
    ` as const,

    mapRow(row: FleaMarketDetailsRow): FleaMarketDetailsView {
      // Nested rows are narrowed to the fields the domain actually uses.
      // Columns like flea_market_id / created_at on the joined rows are
      // intentionally dropped — the domain doesn't read them, and keeping the
      // mapping explicit makes a regression visible if someone starts relying
      // on a passthrough field.
      const { profiles, opening_hour_rules, opening_hour_exceptions, flea_market_images, ...rest } = row
      return {
        id: rest.id,
        name: rest.name,
        // DB columns are nullable; the domain type narrows to non-null by coercing
        // null → '' / 0 at the query boundary. Historical behavior of the adapter.
        description: rest.description ?? '',
        street: rest.street ?? '',
        zipCode: rest.zip_code ?? '',
        city: rest.city ?? '',
        country: rest.country ?? '',
        latitude: rest.latitude ?? 0,
        longitude: rest.longitude ?? 0,
        isPermanent: rest.is_permanent,
        organizerId: rest.organizer_id,
        autoAcceptBookings: rest.auto_accept_bookings,
        publishedAt: rest.published_at,
        createdAt: rest.created_at,
        slug: rest.slug ?? null,
        isSystemOwned: rest.is_system_owned,
        contactWebsite: rest.contact_website,
        contactPhone: rest.contact_phone,
        contactEmail: rest.contact_email,
        googlePlaceId: rest.google_place_id,
        organizerName: formatName(profiles),
        organizerSubscriptionTier: profiles?.subscription_tier ?? 0,
        openingHourRules: opening_hour_rules.map((r) => ({
          id: r.id,
          type: r.type as RuleType,
          dayOfWeek: r.day_of_week,
          anchorDate: r.anchor_date,
          openTime: r.open_time,
          closeTime: r.close_time,
        })),
        openingHourExceptions: opening_hour_exceptions.map((e) => ({
          id: e.id,
          date: e.date,
          reason: e.reason,
        })),
        images: flea_market_images.map((img) => ({
          id: img.id,
          storagePath: img.storage_path,
          sortOrder: img.sort_order,
        })),
      }
    },
  },
} as const
