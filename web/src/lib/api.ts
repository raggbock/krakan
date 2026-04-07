import { supabase } from './supabase'

export const api = {
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
      return { items: data ?? [], count: count ?? 0 }
    },

    details: async (id: string) => {
      const { data, error } = await supabase
        .from('flea_markets')
        .select(
          `
          *,
          opening_hours (*),
          flea_market_images (*),
          profiles!flea_markets_organizer_id_fkey (first_name, last_name)
        `,
        )
        .eq('id', id)
        .single()

      if (error) throw error

      const profile = (data as any).profiles
      return {
        ...data,
        organizerName: profile
          ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
          : '',
      } as FleaMarketDetails
    },

    nearBy: async (params: {
      latitude: number
      longitude: number
      radiusKm: number
    }) => {
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

      // Replace opening hours
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
}

// Types

export type FleaMarket = {
  id: string
  name: string
  description: string
  street: string
  zip_code: string
  city: string
  country: string
  is_permanent: boolean
  published_at: string | null
  organizer_id: string
  created_at: string
}

export type FleaMarketDetails = FleaMarket & {
  organizerName: string
  opening_hours: OpeningHoursItem[]
  flea_market_images: FleaMarketImage[]
}

export type FleaMarketNearBy = {
  id: string
  name: string
  description: string
  city: string
  is_permanent: boolean
  latitude: number
  longitude: number
  distance_km: number
  published_at: string | null
}

export type OpeningHoursItem = {
  id: string
  day_of_week: number | null
  date: string | null
  open_time: string
  close_time: string
}

export type FleaMarketImage = {
  id: string
  storage_path: string
  sort_order: number
}

export type SearchResult = {
  fleaMarkets: FleaMarket[]
}

export type UserProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  phone_number: string | null
  user_type: number
}

export type AddressPayload = {
  street: string
  city: string
  zipCode: string
  state: string
  country: string
  location: { latitude: number; longitude: number }
}

export type CreateFleaMarketPayload = {
  name: string
  description: string
  address: AddressPayload
  isPermanent: boolean
  organizerId: string
  openingHours: {
    dayOfWeek: number | null
    date: string | null
    openTime: string
    closeTime: string
  }[]
}

export type UpdateFleaMarketPayload = Omit<
  CreateFleaMarketPayload,
  'organizerId'
>
