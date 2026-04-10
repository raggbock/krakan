import React, { useState, useEffect, ReactNode, FC } from 'react'
import { useDispatch } from 'react-redux'
import styled from 'styled-components/native'
import { useLocale } from '../features/locale/useLocale'
import { locationGetUserLocation } from '../features/location/locationSlice'
import { supabase } from '../lib/supabase'
import { Sentry } from '../lib/sentry'
import { contextClear } from '../features/context/contextSlice'
import { Spinner } from '../components'
import { AppDispatch } from './store'
import { authSignInSuccess, authSignOut } from '../features/auth/authSlice'
import {
  navigationShouldShowSignIn,
  navigationShouldShowApp,
} from '../features/navigation/navigationSlice'

const Container = styled.View`
  flex: 1;
`

interface AppLoaderProps {
  children: ReactNode
}

const AppLoader: FC<AppLoaderProps> = ({ children }) => {
  const dispatch: AppDispatch = useDispatch()
  const [isLoading, setLoading] = useState(true)
  const { isLoading: isLocaleLoading } = useLocale()

  useEffect(() => {
    dispatch(locationGetUserLocation())
  }, [])

  // Listen to Supabase auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        dispatch(authSignInSuccess())
        dispatch(navigationShouldShowApp())
      } else {
        dispatch(authSignOut())
        dispatch(contextClear())
        dispatch(navigationShouldShowSignIn())
      }
      setLoading(false)
    })
    .catch((err) => {
      Sentry.captureException(err)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        dispatch(authSignInSuccess())
        dispatch(navigationShouldShowApp())
      } else {
        dispatch(authSignOut())
        dispatch(contextClear())
        dispatch(navigationShouldShowSignIn())
      }
    })

    return () => subscription.unsubscribe()
  }, [dispatch])

  // Timeout fallback
  useEffect(() => {
    const timeoutId = setTimeout(() => setLoading(false), 5000)
    return () => clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    if (!isLocaleLoading) {
      setLoading(false)
    }
  }, [isLocaleLoading])

  return <Container>{isLoading ? <Spinner /> : children}</Container>
}

export default AppLoader
