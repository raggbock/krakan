'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import { useIsFollowingMarket, useFollowMarket } from '@/hooks/use-follows'

type Props = {
  /** The entity kind. 'city' is accepted for API stability (issue #152) but not yet active. */
  kind: 'market' | 'city'
  /** The entity identifier: marketId for kind='market'. */
  target: string
  /** Optional analytics source label. */
  source?: string
}

/**
 * FollowButton — toggles a follow/unfollow relationship for a market.
 *
 * - Logged-in users: optimistic toggle via React Query mutation.
 * - Anonymous users: navigates to /auth?next=<current-path> on click.
 * - Loading state (initial query): renders a disabled "Följ" placeholder.
 *
 * kind='city' is accepted in the props API (issue #152 will activate it)
 * but renders null for now so the prop surface is stable.
 */
export function FollowButton({ kind, target, source: _source }: Props) {
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  // City follow is not yet implemented — render nothing until issue #152.
  if (kind !== 'market') return null

  return (
    <FollowMarketButton
      marketId={target}
      userId={user?.id}
      currentPath={pathname}
      onAnonClick={() =>
        router.push(`/auth?next=${encodeURIComponent(pathname ?? '')}`)
      }
    />
  )
}

// ─── Inner component — keeps hook rules clean (no early return above hooks) ──

function FollowMarketButton({
  marketId,
  userId,
  currentPath: _currentPath,
  onAnonClick,
}: {
  marketId: string
  userId: string | undefined
  currentPath: string | null
  onAnonClick: () => void
}) {
  const { isFollowing, isLoading } = useIsFollowingMarket(userId, marketId)
  const { follow, unfollow } = useFollowMarket(userId, marketId)

  const base =
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors shadow-sm'

  // Anonymous visitor
  if (!userId) {
    return (
      <button
        type="button"
        onClick={onAnonClick}
        className={`${base} bg-rust text-white hover:bg-rust-light`}
        aria-label="Följ loppisen"
      >
        <HeartIcon filled={false} />
        Följ
      </button>
    )
  }

  // Loading initial state
  if (isLoading) {
    return (
      <button
        type="button"
        disabled
        className={`${base} bg-cream-warm text-espresso/40 cursor-default`}
        aria-label="Laddar följningsstatus"
      >
        <HeartIcon filled={false} />
        Följ
      </button>
    )
  }

  const following = isFollowing === true

  function handleClick() {
    if (following) {
      unfollow.mutate()
    } else {
      follow.mutate()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={following}
      aria-label={following ? 'Avfölj loppisen' : 'Följ loppisen'}
      className={`${base} ${
        following
          ? 'bg-forest text-white hover:bg-forest-light'
          : 'bg-rust text-white hover:bg-rust-light'
      }`}
    >
      <HeartIcon filled={following} />
      {following ? 'Följer' : 'Följ'}
    </button>
  )
}

// ─── Icon ────────────────────────────────────────────────────────────────────

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
