import 'react-native-gesture-handler'
import React, { useEffect } from 'react'
import { Provider, useDispatch } from 'react-redux'
import { LogBox } from 'react-native'

import ThemeProvider from './features/theme/ThemeProvider'
// import { PortalProvider } from '../components/Portal';
import { LocaleProvider } from './features/locale/LocaleContext'
import Router from './features/navigation/Router'
import useTranslation from './features/locale/useTranslation'

import store from './app/store'
import AppLoader from './app/AppLoader'
// import AppLoader from './AppLoader';

export default function App() {
  LogBox.ignoreAllLogs()

  return (
    <LocaleProvider>
      <Provider store={store}>
        <ThemeProvider>
          {/* <PortalProvider> */}
          <AppLoader>
            <Router />
          </AppLoader>
          {/* </PortalProvider> */}
        </ThemeProvider>
      </Provider>
    </LocaleProvider>
  )
}
