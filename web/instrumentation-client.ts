import * as Sentry from "@sentry/nextjs"

const consent =
  typeof window !== 'undefined'
    ? window.localStorage.getItem('fyndstigen-cookie-consent')
    : null
const hasConsent = consent === 'accepted'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // PII (IPs, cookies, user context) only with consent
  sendDefaultPii: hasConsent,

  // 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Session Replay records the DOM = personal data. Only with consent.
  replaysSessionSampleRate: hasConsent ? 0.1 : 0,
  replaysOnErrorSampleRate: hasConsent ? 1.0 : 0,

  enableLogs: true,

  ignoreErrors: [
    // Supabase auth-klienten använder Web Locks för cross-tab token-refresh;
    // när en annan flik/instans stjäl låset rejectar den hängande request
    // med AbortError. Inget stacktrace, inget vi kan göra.
    /Lock broken by another request with the 'steal' option/,
  ],

  integrations: hasConsent ? [Sentry.replayIntegration()] : [],
})

// Hook into App Router navigation transitions
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
