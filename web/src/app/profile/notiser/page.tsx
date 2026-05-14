'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { useAuth } from '@/lib/auth/auth-context'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { useInbox, useMarkRead, useMarkAllRead } from '@/hooks/use-notifications'
import { formatEventText, formatRelativeTime, notificationTargetUrl } from '@/lib/notification-copy'

const PAGE_SIZE = 50

export default function NotiserPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const posthog = usePostHog()
  const { data: rows = [], isLoading } = useInbox(user?.id, { limit: PAGE_SIZE })
  const markRead = useMarkRead(user?.id)
  const markAllRead = useMarkAllRead(user?.id)

  // Auth guard — redirect anon users with next param
  useEffect(() => {
    if (authLoading) return
    if (!user) router.push('/auth?next=/profile/notiser&reason=auth-required')
  }, [user, authLoading, router])

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex justify-center py-20">
        <FyndstigenLogo size={40} className="text-rust animate-bob" />
      </div>
    )
  }

  const unreadCount = rows.filter((r) => r.readAt === null).length

  function handleRowClick(eventId: string, targetUrl: string, eventType: string) {
    markRead.mutate(eventId)
    posthog?.capture('notification_clicked', { event_type: eventType, source: 'inbox_page' })
    router.push(targetUrl)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {/* Back link */}
      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 text-sm text-espresso/60 hover:text-espresso transition-colors mb-6"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Tillbaka till profil
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Notiser</h1>
          <p className="text-sm text-espresso/60 mt-0.5">
            Aktivitet från loppisar och städer du följer, senaste 30 dagarna.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-sm font-semibold text-rust hover:text-rust-light transition-colors disabled:opacity-50"
          >
            {markAllRead.isPending ? 'Markerar...' : 'Markera alla som lästa'}
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <FyndstigenLogo size={32} className="text-rust animate-bob" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && rows.length === 0 && (
        <div className="vintage-card p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-cream-warm flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-espresso/30">
              <path
                d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5A.75.75 0 0 0 3 15h14a.75.75 0 0 0 .5-1.5L16 11V8a6 6 0 0 0-6-6Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M8 15a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="font-display text-lg font-bold mb-2">Inga notiser ännu</h2>
          <p className="text-sm text-espresso/60 max-w-xs mx-auto">
            Följ loppisar och städer för att få notiser när något nytt händer.
          </p>
          <Link
            href="/utforska"
            className="inline-block mt-5 text-sm font-semibold text-rust hover:text-rust-light transition-colors"
          >
            Utforska loppisar &rarr;
          </Link>
        </div>
      )}

      {/* Notification list */}
      {!isLoading && rows.length > 0 && (
        <div className="vintage-card overflow-hidden">
          <ul className="divide-y divide-cream-warm">
            {rows.map((row) => {
              const targetUrl = notificationTargetUrl(row)
              const isUnread = row.readAt === null

              return (
                <li key={row.eventId}>
                  <button
                    type="button"
                    className={`w-full text-left px-5 py-4 hover:bg-cream-warm/40 transition-colors duration-150 flex items-start gap-4 ${isUnread ? 'bg-rust/[0.03]' : ''}`}
                    onClick={() => handleRowClick(row.eventId, targetUrl, row.eventType)}
                  >
                    {/* Unread indicator */}
                    <span
                      className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${isUnread ? 'bg-rust' : 'bg-transparent'}`}
                      aria-hidden="true"
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${isUnread ? 'font-medium text-espresso' : 'text-espresso/75'}`}>
                        {formatEventText(row)}
                      </p>
                      <p className="text-xs text-espresso/45 mt-1">
                        {formatRelativeTime(row.occurredAt)}
                      </p>
                    </div>

                    {/* Arrow */}
                    <span className="text-espresso/20 hover:text-rust/40 transition-colors mt-0.5 flex-shrink-0">
                      &rarr;
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
