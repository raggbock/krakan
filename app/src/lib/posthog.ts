import PostHog from 'posthog-react-native'
import { POSTHOG_KEY, POSTHOG_HOST } from '@env'

export let posthog: PostHog | null = null

export async function initPostHog() {
  if (!POSTHOG_KEY || !POSTHOG_HOST) return

  posthog = await PostHog.initAsync(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    enableSessionReplay: false,
  })
}
