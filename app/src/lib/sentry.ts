import * as Sentry from '@sentry/react-native'
import { SENTRY_DSN } from '@env'

export function initSentry() {
  if (!SENTRY_DSN) return

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 1.0,
    debug: __DEV__,
    enabled: !__DEV__,
  })
}

export { Sentry }
