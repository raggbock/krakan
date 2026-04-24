import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  FleaMarket,
  FleaMarketDetails,
  FleaMarketNearBy,
  MarketTable,
  CreateFleaMarketPayload,
  UpdateFleaMarketPayload,
  CreateMarketTablePayload,
  SearchResult,
} from '../../types'
import { FleaMarketQuery, type FleaMarketDetailsRow } from '../../query/flea-market'
import type { FleaMarketRepository, SearchRepository, MarketTableRepository } from '../../ports/flea-markets'

export function createSupabaseFleaMarkets(supabase: SupabaseClient): FleaMarketRepository {
  return {
    async list(params) {
      const page = params?.page ?? 1
      const pageSize = params?.pageSize ?? 20
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data, count, error } = await supabase
        .from('visible_flea_markets')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error
      return { items: data ?? [], count: count ?? 0 } as { items: FleaMarket[]; count: number }
    },

    async details(id) {
      const { data, error } = await supabase
        .from('flea_markets')
        .select(FleaMarketQuery.details.select)
        .eq('id', id)
        .single()

      if (error) throw error
      return FleaMarketQuery.details.mapRow(data as FleaMarketDetailsRow)
    },

    async nearBy(params) {
      const { data, error } = await supabase.rpc('nearby_flea_markets', {
        lat: params.latitude,
        lng: params.longitude,
        radius_km: params.radiusKm,
      })
      if (error) throw error
      return data as FleaMarketNearBy[]
    },

    async create(payload) {
      const { data, error } = await supabase
        .from('flea_markets')
        .insert({
          name: payload.name,
          description: payload.description,
          street: payload.address.street,
          zip_code: payload.address.zipCode,
          city: payload.address.city,
          country: payload.address.country,
          location: `POINT(${payload.address.location.longitude} ${payload.address.location.latitude})`,
          is_permanent: payload.isPermanent,
          organizer_id: payload.organizerId,
          auto_accept_bookings: payload.autoAcceptBookings ?? false,
        })
        .select('id')
        .single()

      if (error) throw error

      if (payload.openingHours?.length) {
        const { error: ohError } = await supabase.from('opening_hour_rules').insert(
          payload.openingHours.map((oh) => ({
            flea_market_id: data.id,
            type: oh.type,
            day_of_week: oh.dayOfWeek,
            anchor_date: oh.anchorDate,
            open_time: oh.openTime,
            close_time: oh.closeTime,
          })),
        )
        if (ohError) throw ohError
      }

      if (payload.openingHourExceptions?.length) {
        const { error: exError } = await supabase.from('opening_hour_exceptions').insert(
          payload.openingHourExceptions.map((ex) => ({
            flea_market_id: data.id,
            date: ex.date,
            reason: ex.reason,
          })),
        )
        if (exError) throw exError
      }

      return { id: data.id }
    },

    async update(id, payload) {
      const { error } = await supabase
        .from('flea_markets')
        .update({
          name: payload.name,
          description: payload.description,
          street: payload.address.street,
          zip_code: payload.address.zipCode,
          city: payload.address.city,
          country: payload.address.country,
          location: `POINT(${payload.address.location.longitude} ${payload.address.location.latitude})`,
          is_permanent: payload.isPermanent,
        })
        .eq('id', id)

      if (error) throw error

      await supabase.from('opening_hour_rules').delete().eq('flea_market_id', id)
      if (payload.openingHours?.length) {
        const { error: ohError } = await supabase.from('opening_hour_rules').insert(
          payload.openingHours.map((oh) => ({
            flea_market_id: id,
            type: oh.type,
            day_of_week: oh.dayOfWeek,
            anchor_date: oh.anchorDate,
            open_time: oh.openTime,
            close_time: oh.closeTime,
          })),
        )
        if (ohError) throw ohError
      }

      await supabase.from('opening_hour_exceptions').delete().eq('flea_market_id', id)
      if (payload.openingHourExceptions?.length) {
        const { error: exError } = await supabase.from('opening_hour_exceptions').insert(
          payload.openingHourExceptions.map((ex) => ({
            flea_market_id: id,
            date: ex.date,
            reason: ex.reason,
          })),
        )
        if (exError) throw exError
      }
    },

    async delete(id) {
      const { error } = await supabase
        .from('flea_markets')
        .update({ is_deleted: true })
        .eq('id', id)
      if (error) throw error
    },

    async publish(id) {
      const { error } = await supabase
        .from('flea_markets')
        .update({ published_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },

    async unpublish(id) {
      const { error } = await supabase
        .from('flea_markets')
        .update({ published_at: null })
        .eq('id', id)
      if (error) throw error
    },

    async listByOrganizer(organizerId) {
      // Fetch all non-deleted markets for this organizer
      const { data, error } = await supabase
        .from('flea_markets')
        .select('*')
        .eq('organizer_id', organizerId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      const markets = data ?? []
      if (markets.length === 0) return []

      // Determine which of these are publicly visible using the existing view.
      // Two queries total (independent of N) — avoids N+1 RPC calls.
      const ids = markets.map((m) => m.id)
      const { data: visibleData, error: visibleError } = await supabase
        .from('visible_flea_markets')
        .select('id')
        .in('id', ids)

      if (visibleError) throw visibleError
      const visibleIds = new Set((visibleData ?? []).map((r: { id: string }) => r.id))

      return markets.map((m) => ({ ...m, isVisible: visibleIds.has(m.id) })) as FleaMarket[]
    },
  }
}

export function createSupabaseSearch(supabase: SupabaseClient): SearchRepository {
  return {
    async query(query) {
      const { data, error } = await supabase
        .from('visible_flea_markets')
        .select('*')
        .ilike('name', `%${query.replace(/[%_\\]/g, '\\$&')}%`)
        .limit(20)

      if (error) throw error
      return { fleaMarkets: data ?? [] } as SearchResult
    },
  }
}

export function createSupabaseMarketTables(supabase: SupabaseClient): MarketTableRepository {
  return {
    async list(fleaMarketId) {
      const { data, error } = await supabase
        .from('market_tables')
        .select('*')
        .eq('flea_market_id', fleaMarketId)
        .eq('is_available', true)
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as MarketTable[]
    },

    async create(payload) {
      const { data, error } = await supabase
        .from('market_tables')
        .insert({
          flea_market_id: payload.fleaMarketId,
          label: payload.label,
          description: payload.description,
          price_sek: payload.priceSek,
          size_description: payload.sizeDescription,
        })
        .select('id')
        .single()
      if (error) throw error
      return { id: data.id }
    },

    async update(id, updates) {
      const { error } = await supabase
        .from('market_tables')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    },

    async delete(id) {
      const { error } = await supabase
        .from('market_tables')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
  }
}
