import { PayloadAction, createSlice } from '@reduxjs/toolkit'

import { supabase } from '../../lib/supabase'
import { AppThunk } from '../../app/store'

type ErrorDetails = { message: string } | null

export interface SignUpDetails {
  firstname?: string
  lastname?: string
  email?: string
  phoneNumber?: string
  password?: string
  userType?: number
}

interface AuthState {
  isLoggedIn: boolean
  isLoggingIn: boolean
  isCreatingUser: boolean
  createUserSuccess: boolean
  signUpDetails: SignUpDetails
  createUserError: ErrorDetails
  loginError: ErrorDetails
  signOutError: ErrorDetails
}

const initialState: AuthState = {
  isLoggedIn: false,
  isLoggingIn: false,
  isCreatingUser: false,
  createUserSuccess: false,
  signUpDetails: {},
  createUserError: null,
  loginError: null,
  signOutError: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authSignInStart(state) {
      state.loginError = null
      state.isLoggingIn = true
    },
    authSignInSuccess(state) {
      state.isLoggedIn = true
      state.isLoggingIn = false
      state.signUpDetails = {}
    },
    authSignInFailure(
      state,
      action: PayloadAction<{ loginError: ErrorDetails }>,
    ) {
      state.isLoggingIn = false
      state.loginError = action.payload.loginError
    },
    authUpdateSignUpDetails(
      state,
      action: PayloadAction<{ details: SignUpDetails }>,
    ) {
      const { details } = action.payload
      state.signUpDetails = {
        ...state.signUpDetails,
        ...details,
      }
    },
    authCreateUserStart(state) {
      state.isCreatingUser = true
      state.createUserError = null
      state.createUserSuccess = false
    },
    authCreateUserSuccess(state) {
      state.isCreatingUser = false
      state.createUserError = null
      state.createUserSuccess = true
    },
    authCreateUserFailure(
      state,
      action: PayloadAction<{ error: ErrorDetails }>,
    ) {
      state.isCreatingUser = false
      state.createUserError = action.payload.error
    },
    authSignOut(state) {
      state.isLoggedIn = false
    },
    authSignOutFailure(
      state,
      action: PayloadAction<{ error: ErrorDetails }>,
    ) {
      state.signOutError = action.payload.error
    },
  },
})

export const {
  authSignInStart,
  authSignInSuccess,
  authSignInFailure,
  authUpdateSignUpDetails,
  authCreateUserStart,
  authCreateUserSuccess,
  authCreateUserFailure,
  authSignOut,
  authSignOutFailure,
} = authSlice.actions

export function signInWithEmailPassword(
  email: string,
  password: string,
): AppThunk<Promise<void>> {
  return async (dispatch) => {
    try {
      dispatch(authSignInStart())
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      dispatch(authSignInSuccess())
    } catch (error: any) {
      dispatch(
        authSignInFailure({ loginError: { message: error.message } }),
      )
    }
  }
}

export function requestCreateUser({
  email,
  password,
  firstname,
  lastname,
  phoneNumber,
}: Required<
  Pick<
    SignUpDetails,
    'email' | 'password' | 'firstname' | 'lastname' | 'phoneNumber'
  >
>): AppThunk<Promise<void>> {
  return async (dispatch) => {
    try {
      dispatch(authCreateUserStart())
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstname,
            last_name: lastname,
            phone_number: phoneNumber,
          },
        },
      })
      if (error) throw error
      dispatch(authCreateUserSuccess())
      dispatch(authSignInSuccess())
    } catch (error: any) {
      dispatch(
        authCreateUserFailure({ error: { message: error.message } }),
      )
    }
  }
}

export function handleSignOut(): AppThunk<Promise<void>> {
  return async (dispatch) => {
    try {
      await supabase.auth.signOut()
      dispatch(authSignOut())
    } catch (error: any) {
      dispatch(
        authSignOutFailure({ error: { message: error.message } }),
      )
    }
  }
}

export default authSlice.reducer
