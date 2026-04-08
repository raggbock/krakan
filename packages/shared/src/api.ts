import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateCommission, COMMISSION_RATE, isValidStatusTransition } from './booking'
import type {
  FleaMarket,
  FleaMarketDetails,
  FleaMarketNearBy,
  FleaMarketImage,
  UserProfile,
  OrganizerProfile,
  OrganizerStats,
  MarketTable,
  Booking,
  BookingWithDetails,
  BookingStatus,
  Route,
  RouteWithStops,
  RouteSummary,
  PopularRoute,
  SearchResult,
  CreateFleaMarketPayload,
  UpdateFleaMarketPayload,
  CreateRoutePayload,
  UpdateRoutePayload,
  CreateBookingPayload,
  CreateMarketTablePayload,
} from './types'

export function createApi(supabase: SupabaseClient) {
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
            opening_hours (*),
            flea_market_images (*),
            profiles!flea_markets_organizer_id_fkey (first_name, last_name)
          `)
          .eq('id', id)
          .single()

        if (error) throw error

        const profile = (data as Record<string, unknown>).profiles as { first_name?: string; last_name?: string } | null
        return {
          ...data,
          organizerName: profile
            ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
            : '',
        } as FleaMarketDetails
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
          })
          .select('id')
          .single()

        if (error) throw error

        if (payload.openingHours?.length) {
          const { error: ohError } = await supabase
            .from('opening_hours')
            .insert(
              payload.openingHours.map((oh) => ({
                flea_market_id: data.id,
                day_of_week: oh.dayOfWeek,
                date: oh.date,
                open_time: oh.openTime,
                close_time: oh.closeTime,
              })),
            )
          if (ohError) throw ohError
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

        await supabase.from('opening_hours').delete().eq('flea_market_id', id)

        if (payload.openingHours?.length) {
          const { error: ohError } = await supabase
            .from('opening_hours')
            .insert(
              payload.openingHours.map((oh) => ({
                flea_market_id: id,
                day_of_week: oh.dayOfWeek,
                date: oh.date,
                open_time: oh.openTime,
                close_time: oh.closeTime,
              })),
            )
          if (ohError) throw ohError
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
          .ilike('name', `%${query}%`)
          .limit(20)

        if (error) throw error
        return { fleaMarkets: data ?? [] } as SearchResult
      },
    },

    profiles: {
      get: async (userId: string) => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        if (error) throw error
        return data as UserProfile
      },

      update: async (userId: string, updates: Partial<UserProfile>) => {
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', userId)
        if (error) throw error
      },
    },

    routes: {
      create: async (payload: CreateRoutePayload) => {
        const { data, error } = await supabase
          .from('routes')
          .insert({
            name: payload.name,
            description: payload.description,
            created_by: payload.createdBy,
            start_latitude: payload.startLatitude,
            start_longitude: payload.startLongitude,
            planned_date: payload.plannedDate,
          })
          .select('id')
          .single()

        if (error) throw error

        if (payload.stops?.length) {
          const { error: stopsError } = await supabase
            .from('route_stops')
            .insert(
              payload.stops.map((stop, i) => ({
                route_id: data.id,
                flea_market_id: stop.fleaMarketId,
                sort_order: i,
              })),
            )
          if (stopsError) throw stopsError
        }

        return { id: data.id }
      },

      get: async (id: string) => {
        const { data, error } = await supabase
          .from('routes')
          .select(`
            *,
            route_stops (
              id,
              flea_market_id,
              sort_order,
              flea_markets (
                id, name, description, street, zip_code, city, country,
                is_permanent, latitude, longitude,
                opening_hours (day_of_week, date, open_time, close_time)
              )
            ),
            profiles!routes_created_by_fkey (first_name, last_name)
          `)
          .eq('id', id)
          .single()

        if (error) throw error

        const raw = data as Record<string, unknown>
        const profile = raw.profiles as { first_name?: string; last_name?: string } | null
        const stops = ((raw.route_stops ?? []) as Array<Record<string, unknown>>)
          .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
          .map((rs) => {
            const fm = rs.flea_markets as Record<string, unknown> | null
            return {
              id: rs.id as string,
              sortOrder: rs.sort_order as number,
              fleaMarket: fm
                ? { ...fm, openingHours: (fm.opening_hours as unknown[]) ?? [] }
                : null,
            }
          })

        return {
          ...data,
          creatorName: profile
            ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
            : '',
          stops,
        } as RouteWithStops
      },

      update: async (id: string, payload: UpdateRoutePayload) => {
        const { error } = await supabase
          .from('routes')
          .update({
            name: payload.name,
            description: payload.description,
            start_latitude: payload.startLatitude,
            start_longitude: payload.startLongitude,
            planned_date: payload.plannedDate,
          })
          .eq('id', id)

        if (error) throw error

        await supabase.from('route_stops').delete().eq('route_id', id)

        if (payload.stops?.length) {
          const { error: stopsError } = await supabase
            .from('route_stops')
            .insert(
              payload.stops.map((stop, i) => ({
                route_id: id,
                flea_market_id: stop.fleaMarketId,
                sort_order: i,
              })),
            )
          if (stopsError) throw stopsError
        }
      },

      delete: async (id: string) => {
        const { error } = await supabase
          .from('routes')
          .update({ is_deleted: true })
          .eq('id', id)
        if (error) throw error
      },

      publish: async (id: string) => {
        const { error } = await supabase
          .from('routes')
          .update({ is_published: true, published_at: new Date().toISOString() })
          .eq('id', id)
        if (error) throw error
      },

      unpublish: async (id: string) => {
        const { error } = await supabase
          .from('routes')
          .update({ is_published: false, published_at: null })
          .eq('id', id)
        if (error) throw error
      },

      listByUser: async (userId: string) => {
        const { data, error } = await supabase
          .from('routes')
          .select('*, route_stops(id)')
          .eq('created_by', userId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })

        if (error) throw error
        return (data ?? []).map((r: Record<string, unknown>) => ({
          ...r,
          stopCount: (r.route_stops as unknown[])?.length ?? 0,
        })) as RouteSummary[]
      },

      listPopular: async (params: { latitude: number; longitude: number; radiusKm?: number }) => {
        const { data, error } = await supabase.rpc('popular_routes_nearby', {
          lat: params.latitude,
          lng: params.longitude,
          radius_km: params.radiusKm ?? 30,
        })
        if (error) throw error
        return (data ?? []) as PopularRoute[]
      },
    },

    organizers: {
      get: async (userId: string) => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        if (error) throw error
        return data as OrganizerProfile
      },

      update: async (
        userId: string,
        updates: Partial<Pick<OrganizerProfile, 'bio' | 'website' | 'first_name' | 'last_name' | 'phone_number'>>,
      ) => {
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', userId)
        if (error) throw error
      },

      stats: async (userId: string) => {
        const { data, error } = await supabase
          .from('organizer_stats')
          .select('*')
          .eq('organizer_id', userId)
          .single()
        if (error && error.code !== 'PGRST116') throw error
        return (data ?? {
          organizer_id: userId,
          market_count: 0,
          total_bookings: 0,
          total_revenue_sek: 0,
          total_commission_sek: 0,
        }) as OrganizerStats
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

    bookings: {
      create: async (payload: CreateBookingPayload) => {
        const commissionSek = calculateCommission(payload.priceSek)

        const { data, error } = await supabase
          .from('bookings')
          .insert({
            market_table_id: payload.marketTableId,
            flea_market_id: payload.fleaMarketId,
            booked_by: payload.bookedBy,
            booking_date: payload.bookingDate,
            price_sek: payload.priceSek,
            commission_sek: commissionSek,
            commission_rate: COMMISSION_RATE,
            message: payload.message,
          })
          .select('id')
          .single()
        if (error) throw error
        return { id: data.id }
      },

      listByUser: async (userId: string) => {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            market_tables (label, description, size_description),
            flea_markets (name, city)
          `)
          .eq('booked_by', userId)
          .order('booking_date', { ascending: false })
        if (error) throw error
        return (data ?? []).map((b: Record<string, unknown>) => ({
          ...b,
          market_table: b.market_tables,
          flea_market: b.flea_markets,
        })) as BookingWithDetails[]
      },

      listByMarket: async (fleaMarketId: string) => {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            market_tables (label, description, size_description),
            profiles!bookings_booked_by_fkey (first_name, last_name)
          `)
          .eq('flea_market_id', fleaMarketId)
          .in('status', ['pending', 'confirmed'])
          .order('booking_date')
        if (error) throw error
        return (data ?? []).map((b: Record<string, unknown>) => ({
          ...b,
          market_table: b.market_tables,
          booker: b.profiles,
        })) as BookingWithDetails[]
      },

      updateStatus: async (id: string, newStatus: 'confirmed' | 'denied' | 'cancelled', note?: string) => {
        const { data: current, error: fetchErr } = await supabase
          .from('bookings')
          .select('status')
          .eq('id', id)
          .single()
        if (fetchErr) throw fetchErr

        if (!isValidStatusTransition(current.status as BookingStatus, newStatus)) {
          throw new Error(`Kan inte ändra status från ${current.status} till ${newStatus}`)
        }

        const updates: Record<string, unknown> = { status: newStatus }
        if (note) updates.organizer_note = note
        const { error } = await supabase
          .from('bookings')
          .update(updates)
          .eq('id', id)
        if (error) throw error
      },

      availableDates: async (marketTableId: string) => {
        const { data, error } = await supabase
          .from('bookings')
          .select('booking_date')
          .eq('market_table_id', marketTableId)
          .in('status', ['pending', 'confirmed'])
        if (error) throw error
        return (data ?? []).map((b: Record<string, unknown>) => b.booking_date as string)
      },
    },
  }
}

export type Api = ReturnType<typeof createApi>
