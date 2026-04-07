import { PayloadAction, createSlice } from '@reduxjs/toolkit'

import { supabase } from '../../lib/supabase'
import { AppThunk } from '../../app/store'

export interface UserProfile {
  id?: string
  first_name?: string
  last_name?: string
  phone_number?: string
  user_type?: number
  email?: string
}

interface ContextState {
  fetchError: string | null
  isFetchingContext: boolean
  profile: UserProfile | null
}

const initialState: ContextState = {
  fetchError: null,
  isFetchingContext: false,
  profile: null,
}

const contextSlice = createSlice({
  name: 'context',
  initialState,
  reducers: {
    contextFetchStart(state) {
      state.fetchError = null
      state.isFetchingContext = true
    },
    contextFetchSuccess(
      state,
      action: PayloadAction<UserProfile>,
    ) {
      state.profile = action.payload
      state.isFetchingContext = false
    },
    contextFetchFailure(
      state,
      action: PayloadAction<string>,
    ) {
      state.isFetchingContext = false
      state.fetchError = action.payload
    },
    contextClear(state) {
      state.fetchError = null
      state.isFetchingContext = false
      state.profile = null
    },
  },
})

export const {
  contextFetchStart,
  contextFetchSuccess,
  contextFetchFailure,
  contextClear,
} = contextSlice.actions

export function requestContext(): AppThunk<Promise<void>> {
  return async (dispatch) => {
    try {
      dispatch(contextFetchStart())

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        dispatch(contextClear())
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      dispatch(
        contextFetchSuccess({
          ...profile,
          email: user.email,
        }),
      )
    } catch (error: any) {
      dispatch(contextFetchFailure(error.message))
    }
  }
}

export default contextSlice.reducer
