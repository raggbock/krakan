import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  FleaMarket,
  FleaMarketNearBy,
  FleaMarketImage,
  SearchResult,
  MarketTable,
  CreateFleaMarketPayload,
  UpdateFleaMarketPayload,
  CreateMarketTablePayload,
} from '../types'
import { mapFleaMarketDetails, type FleaMarketDetailsRow } from './mappers'

export function createFleaMarketsApi(supabase: SupabaseClient) {
  return {
    fleaMarkets: {
      list: async (params?: { page?: number; pageSize?: number }) => {
        const page = params?.page ?? 1
        const pageSize = params?.pageSize ?? 20
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        const { data, count, error } = await supabase
          .from('flea_markets')
          .select('*', { count: 'exact' })
          .not('published_at', 'is', null)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .range(from, to)

        if (error) throw error
        return { items: data ?? [], count: count ?? 0 } as { items: FleaMarket[]; count: number }
      },

      details: async (id: string) => {
        const { data, error } = await supabase
          .from('flea_markets')
          .select(`
            *,
            opening_hour_rules (*),
            opening_hour_exceptions (*),
            flea_market_images (*),
            profiles!flea_markets_organizer_id_fkey (first_name, last_name)
          `)
          .eq('id', id)
          .single()

        if (error) throw error
        return mapFleaMarketDetails(data as FleaMarketDetailsRow)
      },

      nearBy: async (params: { latitude: number; longitude: number; radiusKm: number }) => {
        const { data, error } = await supabase.rpc('nearby_flea_markets', {
          lat: params.latitude,
          lng: params.longitude,
          radius_km: params.radiusKm,
        })
        if (error) throw error
        return data as FleaMarketNearBy[]
      },

      create: async (payload: CreateFleaMarketPayload) => {
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

        // Insert opening hour rules
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

        // Insert opening hour exceptions
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

      update: async (id: string, payload: UpdateFleaMarketPayload) => {
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

        // Replace opening hour rules
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

        // Replace opening hour exceptions
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

      delete: async (id: string) => {
        const { error } = await supabase
          .from('flea_markets')
          .update({ is_deleted: true })
          .eq('id', id)
        if (error) throw error
      },

      publish: async (id: string) => {
        const { error } = await supabase
          .from('flea_markets')
          .update({ published_at: new Date().toISOString() })
          .eq('id', id)
        if (error) throw error
      },

      unpublish: async (id: string) => {
        const { error } = await supabase
          .from('flea_markets')
          .update({ published_at: null })
          .eq('id', id)
        if (error) throw error
      },

      listByOrganizer: async (organizerId: string) => {
        const { data, error } = await supabase
          .from('flea_markets')
          .select('*')
          .eq('organizer_id', organizerId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })

        if (error) throw error
        return (data ?? []) as FleaMarket[]
      },
    },

    search: {
      query: async (query: string) => {
        const { data, error } = await supabase
          .from('flea_markets')
          .select('*')
          .not('published_at', 'is', null)
          .eq('is_deleted', false)
          .ilike('name', `%${query.replace(/[%_\\]/g, '\\$&')}%`)
          .limit(20)

        if (error) throw error
        return { fleaMarkets: data ?? [] } as SearchResult
      },
    },

    images: {
      upload: async (fleaMarketId: string, file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const path = `${fleaMarketId}/${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('flea-market-images')
          .upload(path, file)
        if (uploadError) throw uploadError

        const { data: existing } = await supabase
          .from('flea_market_images')
          .select('sort_order')
          .eq('flea_market_id', fleaMarketId)
          .order('sort_order', { ascending: false })
          .limit(1)

        const nextOrder = ((existing?.[0]?.sort_order ?? -1) as number) + 1

        const { data, error } = await supabase
          .from('flea_market_images')
          .insert({
            flea_market_id: fleaMarketId,
            storage_path: path,
            sort_order: nextOrder,
          })
          .select('id, storage_path, sort_order')
          .single()
        if (error) throw error
        return data as FleaMarketImage
      },

      delete: async (imageId: string, storagePath: string) => {
        const { error: storageErr } = await supabase.storage
          .from('flea-market-images')
          .remove([storagePath])
        if (storageErr) throw storageErr

        const { error } = await supabase
          .from('flea_market_images')
          .delete()
          .eq('id', imageId)
        if (error) throw error
      },

      getPublicUrl: (storagePath: string) => {
        const { data } = supabase.storage
          .from('flea-market-images')
          .getPublicUrl(storagePath)
        return data.publicUrl
      },
    },

    marketTables: {
      list: async (fleaMarketId: string) => {
        const { data, error } = await supabase
          .from('market_tables')
          .select('*')
          .eq('flea_market_id', fleaMarketId)
          .eq('is_available', true)
          .order('sort_order')
        if (error) throw error
        return (data ?? []) as MarketTable[]
      },

      create: async (payload: CreateMarketTablePayload) => {
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

      update: async (id: string, updates: Partial<MarketTable>) => {
        const { error } = await supabase
          .from('market_tables')
          .update(updates)
          .eq('id', id)
        if (error) throw error
      },

      delete: async (id: string) => {
        const { error } = await supabase
          .from('market_tables')
          .delete()
          .eq('id', id)
        if (error) throw error
      },
    },
  }
}
