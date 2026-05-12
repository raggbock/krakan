'use client'

import { usePathname, useRouter } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'
import { useAuth } from '@/lib/auth/auth-context'
import {
  useIsFollowingMarket,
  useFollowMarket,
  useIsFollowingCity,
  useFollowCity,
} from '@/hooks/use-follows'

type Props = {
  /** The entity kind. */
  kind: 'market' | 'city'
  /** The entity identifier: marketId for kind='market', citySlug for kind='city'. */
  target: string
  /**
   * Analytics source label forwarded into PostHog events.
   * Examples: 'detail', 'utforska', 'search', 'hub', 'city_page'
   */
  source?: string
  /**
   * Compact icon-only variant for use inside cards.
   * Renders a small circular button without text label.
   */
  compact?: boolean
}

/**
 * FollowButton — toggles a follow/unfollow relationship for a market or city.
 *
 * - Logged-in users: optimistic toggle via React Query mutation.
 * - Anonymous users: navigates to /auth?next=<current-path> on click.
 * - Loading state (initial query): renders a disabled placeholder.
 *
 * For kind='market': uses heart icon, labels "Följ" / "Följer".
 * For kind='city': uses bookmark icon, labels "Bevaka" / "Bevakar".
 */
export function FollowButton({ kind, target, source, compact }: Props) {
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const onAnonClick = () =>
    router.push(`/auth?next=${encodeURIComponent(pathname ?? '')}`)

  if (kind === 'city') {
    return (
      <FollowCityButton
        citySlug={target}
        userId={user?.id}
        onAnonClick={onAnonClick}
        source={source}
        compact={compact}
      />
    )
  }

  return (
    <FollowMarketButton
      marketId={target}
      userId={user?.id}
      currentPath={pathname}
      onAnonClick={onAnonClick}
      source={source}
      compact={compact}
    />
  )
}

// ─── Market follow button ─────────────────────────────────────────────────────

function FollowMarketButton({
  marketId,
  userId,
  currentPath: _currentPath,
  onAnonClick,
  source,
  compact,
}: {
  marketId: string
  userId: string | undefined
  currentPath: string | null
  onAnonClick: () => void
  source?: string
  compact?: boolean
}) {
  const posthog = usePostHog()
  const { isFollowing, isLoading } = useIsFollowingMarket(userId, marketId)
  const { follow, unfollow } = useFollowMarket(userId, marketId)

  const fullBase =
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors shadow-sm'
  const compactBase =
    'inline-flex items-center justify-center w-9 h-9 rounded-full text-white shadow-sm transition-colors'

  if (!userId) {
    return (
      <button
        type="button"
        onClick={onAnonClick}
        className={compact
          ? `${compactBase} bg-rust hover:bg-rust-light`
          : `${fullBase} bg-rust text-white hover:bg-rust-light`}
        aria-label="Följ loppisen"
      >
        <HeartIcon filled={false} />
        {!compact && 'Följ'}
      </button>
    )
  }

  if (isLoading) {
    return (
      <button
        type="button"
        disabled
        className={compact
          ? `${compactBase} bg-cream-warm text-espresso/40 cursor-default`
          : `${fullBase} bg-cream-warm text-espresso/40 cursor-default`}
        aria-label="Laddar följningsstatus"
      >
        <HeartIcon filled={false} />
      </button>
    )
  }

  const following = isFollowing === true

  function handleClick() {
    if (following) {
      unfollow.mutate(undefined, {
        onSuccess: () => {
          posthog?.capture('market_unfollowed', { market_id: marketId, source: source ?? null })
        },
      })
    } else {
      follow.mutate(undefined, {
        onSuccess: () => {
          posthog?.capture('market_followed', { market_id: marketId, source: source ?? null })
        },
      })
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={following}
      aria-label={following ? 'Avfölj loppisen' : 'Följ loppisen'}
      className={compact
        ? `${compactBase} ${following ? 'bg-forest hover:bg-forest-light' : 'bg-rust hover:bg-rust-light'}`
        : `${fullBase} ${following ? 'bg-forest text-white hover:bg-forest-light' : 'bg-rust text-white hover:bg-rust-light'}`}
    >
      <HeartIcon filled={following} />
      {!compact && (following ? 'Följer' : 'Följ')}
    </button>
  )
}

// ─── City follow button ───────────────────────────────────────────────────────

function FollowCityButton({
  citySlug,
  userId,
  onAnonClick,
  source,
  compact,
}: {
  citySlug: string
  userId: string | undefined
  onAnonClick: () => void
  source?: string
  compact?: boolean
}) {
  const posthog = usePostHog()
  const { isFollowing, isLoading } = useIsFollowingCity(userId, citySlug)
  const { follow, unfollow } = useFollowCity(userId, citySlug)

  const fullBase =
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors shadow-sm'
  const compactBase =
    'inline-flex items-center justify-center w-9 h-9 rounded-full text-white shadow-sm transition-colors'

  if (!userId) {
    return (
      <button
        type="button"
        onClick={onAnonClick}
        className={compact
          ? `${compactBase} bg-rust hover:bg-rust-light`
          : `${fullBase} bg-rust text-white hover:bg-rust-light`}
        aria-label="Bevaka staden"
      >
        <BookmarkIcon filled={false} />
        {!compact && 'Bevaka'}
      </button>
    )
  }

  if (isLoading) {
    return (
      <button
        type="button"
        disabled
        className={compact
          ? `${compactBase} bg-cream-warm text-espresso/40 cursor-default`
          : `${fullBase} bg-cream-warm text-espresso/40 cursor-default`}
        aria-label="Laddar bevakningsstatus"
      >
        <BookmarkIcon filled={false} />
      </button>
    )
  }

  const following = isFollowing === true

  function handleClick() {
    if (following) {
      unfollow.mutate(undefined, {
        onSuccess: () => {
          posthog?.capture('city_unfollowed', { city_slug: citySlug, source: source ?? null })
        },
      })
    } else {
      follow.mutate(undefined, {
        onSuccess: () => {
          posthog?.capture('city_followed', { city_slug: citySlug, source: source ?? null })
        },
      })
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={following}
      aria-label={following ? 'Sluta bevaka staden' : 'Bevaka staden'}
      className={compact
        ? `${compactBase} ${following ? 'bg-forest hover:bg-forest-light' : 'bg-rust hover:bg-rust-light'}`
        : `${fullBase} ${following ? 'bg-forest text-white hover:bg-forest-light' : 'bg-rust text-white hover:bg-rust-light'}`}
    >
      <BookmarkIcon filled={following} />
      {!compact && (following ? 'Bevakar' : 'Bevaka')}
    </button>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7.5 13.5C7.5 13.5 1 9 1 4.5C1 2.567 2.567 1 4.5 1C5.632 1 6.643 1.54 7.5 2.5C8.357 1.54 9.368 1 10.5 1C12.433 1 14 2.567 14 4.5C14 9 7.5 13.5 7.5 13.5Z" />
    </svg>
  )
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 1.5h9a1 1 0 011 1v10.5L7.5 10 2 13.5V2.5a1 1 0 011-1z" />
    </svg>
  )
}
