import { PayloadAction, createSlice } from '@reduxjs/toolkit'

import { supabase } from '../../lib/supabase'
import { AppThunk } from '../../app/store'

export interface FleaMarket {
  id: string
  name: string
  description: string
  city: string
  is_permanent: boolean
  latitude: number
  longitude: number
  published_at: string | null
}

export interface FleaMarketDetails extends FleaMarket {
  street: string
  zip_code: string
  country: string
  organizer_id: string
  opening_hours: OpeningHoursItem[]
  flea_market_images: FleaMarketImage[]
}

export interface OpeningHoursItem {
  id: string
  day_of_week: number | null
  date: string | null
  open_time: string
  close_time: string
}

export interface FleaMarketImage {
  id: string
  storage_path: string
}

interface FleaMarketsState {
  isFetching: boolean
  isFetchingDetails: boolean
  fetchError: string | null
  fetchDetailsError: string | null
  items: FleaMarket[]
  selectedDetails: FleaMarketDetails | null
  radiusFilter: number
}

const initialState: FleaMarketsState = {
  isFetching: false,
  isFetchingDetails: false,
  fetchError: null,
  fetchDetailsError: null,
  items: [],
  selectedDetails: null,
  radiusFilter: 30,
}

const fleaMarketsSlice = createSlice({
  name: 'fleaMarkets',
  initialState,
  reducers: {
    fleaMarketsFetchStart(state) {
      state.isFetching = true
      state.fetchError = null
    },
    fleaMarketsFetchSuccess(
      state,
      action: PayloadAction<FleaMarket[]>,
    ) {
      state.isFetching = false
      state.items = action.payload
    },
    fleaMarketsFetchFailure(state, action: PayloadAction<string>) {
      state.isFetching = false
      state.fetchError = action.payload
    },
    fleaMarketDetailsFetchStart(state) {
      state.isFetchingDetails = true
      state.fetchDetailsError = null
    },
    fleaMarketDetailsFetchSuccess(
      state,
      action: PayloadAction<FleaMarketDetails>,
    ) {
      state.isFetchingDetails = false
      state.selectedDetails = action.payload
    },
    fleaMarketDetailsFetchFailure(
      state,
      action: PayloadAction<string>,
    ) {
      state.isFetchingDetails = false
      state.fetchDetailsError = action.payload
    },
    setRadiusFilter(state, action: PayloadAction<number>) {
      state.radiusFilter = action.payload
    },
    clearSelectedDetails(state) {
      state.selectedDetails = null
    },
  },
})

export const {
  fleaMarketsFetchStart,
  fleaMarketsFetchSuccess,
  fleaMarketsFetchFailure,
  fleaMarketDetailsFetchStart,
  fleaMarketDetailsFetchSuccess,
  fleaMarketDetailsFetchFailure,
  setRadiusFilter,
  clearSelectedDetails,
} = fleaMarketsSlice.actions

export function requestGetFleaMarkets(): AppThunk<Promise<void>> {
  return async (dispatch) => {
    try {
      dispatch(fleaMarketsFetchStart())
      const { data, error } = await supabase
        .from('flea_markets')
        .select('id, name, description, city, is_permanent, location, published_at')
        .not('published_at', 'is', null)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      dispatch(fleaMarketsFetchSuccess(data ?? []))
    } catch (error: any) {
      dispatch(fleaMarketsFetchFailure(error.message))
    }
  }
}

export function requestGetNearByFleaMarkets(params: {
  latitude: number
  longitude: number
  radiusKm: number
}): AppThunk<Promise<void>> {
  return async (dispatch) => {
    try {
      dispatch(fleaMarketsFetchStart())
      const { data, error } = await supabase.rpc('nearby_flea_markets', {
        lat: params.latitude,
        lng: params.longitude,
        radius_km: params.radiusKm,
      })

      if (error) throw error
      dispatch(fleaMarketsFetchSuccess(data ?? []))
    } catch (error: any) {
      dispatch(fleaMarketsFetchFailure(error.message))
    }
  }
}

export function requestGetFleaMarketDetails(
  fleaMarketId: string,
): AppThunk<Promise<void>> {
  return async (dispatch) => {
    try {
      dispatch(fleaMarketDetailsFetchStart())
      const { data, error } = await supabase
        .from('flea_markets')
        .select(
          `
          *,
          opening_hours (*),
          flea_market_images (*)
        `,
        )
        .eq('id', fleaMarketId)
        .single()

      if (error) throw error
      dispatch(fleaMarketDetailsFetchSuccess(data))
    } catch (error: any) {
      dispatch(fleaMarketDetailsFetchFailure(error.message))
    }
  }
}

export default fleaMarketsSlice.reducer
