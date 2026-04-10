import 'react-native-gesture-handler'
import React from 'react'
import { Provider } from 'react-redux'
import { LogBox } from 'react-native'

import ThemeProvider from './features/theme/ThemeProvider'
import { LocaleProvider } from './features/locale/LocaleContext'
import Router from './features/navigation/Router'

import store from './app/store'
import AppLoader from './app/AppLoader'
import { initSentry, Sentry } from './lib/sentry'

initSentry()

function App() {
  LogBox.ignoreAllLogs()

  return (
    <LocaleProvider>
      <Provider store={store}>
        <ThemeProvider>
          <AppLoader>
            <Router />
          </AppLoader>
        </ThemeProvider>
      </Provider>
    </LocaleProvider>
  )
}

export default Sentry.wrap(App)
