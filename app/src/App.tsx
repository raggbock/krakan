import 'react-native-gesture-handler'
import React from 'react'
import { Provider } from 'react-redux'
import { LogBox } from 'react-native'

import ThemeProvider from './features/theme/ThemeProvider'
import { LocaleProvider } from './features/locale/LocaleContext'
import Router from './features/navigation/Router'

import store from './app/store'
import AppLoader from './app/AppLoader'
import { PostHogProvider } from 'posthog-react-native'
import { initSentry, Sentry } from './lib/sentry'
import { initPostHog, posthog } from './lib/posthog'

initSentry()
initPostHog()

function App() {
  LogBox.ignoreAllLogs()

  return (
    <PostHogProvider client={posthog}>
      <LocaleProvider>
        <Provider store={store}>
          <ThemeProvider>
            <AppLoader>
              <Router />
            </AppLoader>
          </ThemeProvider>
        </Provider>
      </LocaleProvider>
    </PostHogProvider>
  )
}

export default Sentry.wrap(App)
