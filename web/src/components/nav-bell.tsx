'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { useUnreadCount, useInbox, useMarkRead } from '@/hooks/use-notifications'
import { formatEventText, formatRelativeTime, notificationTargetUrl } from '@/lib/notification-copy'

interface NavBellProps {
  userId: string
}

/**
 * Bell icon with unread-count badge + dropdown showing the last 10 inbox rows.
 *
 * Shown in the nav only for authenticated users.
 * Badge is capped at "9+" for counts > 9.
 * Polling interval: 60 s (configured in useUnreadCount).
 */
export function NavBell({ userId }: NavBellProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const posthog = usePostHog()

  const { data: unread = 0 } = useUnreadCount(userId)
  const { data: rows = [] } = useInbox(userId, { limit: 10 })
  const markRead = useMarkRead(userId)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleRowClick(eventId: string, targetUrl: string, eventType: string) {
    markRead.mutate(eventId)
    posthog?.capture('notification_clicked', { event_type: eventType, source: 'bell' })
    setOpen(false)
    router.push(targetUrl)
  }

  const badgeLabel = unread > 9 ? '9+' : unread > 0 ? String(unread) : null

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Notiser${unread > 0 ? `, ${unread} olästa` : ''}`}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-espresso/75 hover:text-espresso hover:bg-cream-warm/60 transition-all duration-200"
      >
        {/* Bell SVG */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5A.75.75 0 0 0 3 15h14a.75.75 0 0 0 .5-1.5L16 11V8a6 6 0 0 0-6-6Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 15a2 2 0 0 0 4 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        {/* Badge */}
        {badgeLabel && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-rust text-white text-[10px] font-bold flex items-center justify-center leading-none"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-parchment border border-cream-warm rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="px-4 py-3 border-b border-cream-warm flex items-center justify-between">
            <span className="font-display text-sm font-bold text-espresso">Notiser</span>
            {unread > 0 && (
              <span className="text-xs text-espresso/50">
                {unread} olästa
              </span>
            )}
          </div>

          {/* Rows */}
          {rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-espresso/50">
              Inga notiser ännu
            </div>
          ) : (
            <ul>
              {rows.map((row) => {
                const targetUrl = notificationTargetUrl(row)
                const isUnread = row.readAt === null
                return (
                  <li key={row.eventId}>
                    <button
                      type="button"
                      className={`w-full text-left px-4 py-3 border-b border-cream-warm/60 hover:bg-cream-warm/40 transition-colors duration-150 flex items-start gap-3 ${isUnread ? 'bg-rust/3' : ''}`}
                      onClick={() => handleRowClick(row.eventId, targetUrl, row.eventType)}
                    >
                      {/* Unread dot */}
                      <span
                        className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${isUnread ? 'bg-rust' : 'bg-transparent'}`}
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${isUnread ? 'font-medium text-espresso' : 'text-espresso/75'}`}>
                          {formatEventText(row)}
                        </p>
                        <p className="text-xs text-espresso/45 mt-0.5">
                          {formatRelativeTime(row.occurredAt)}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Footer */}
          <div className="px-4 py-3 border-t border-cream-warm">
            <Link
              href="/profile/notiser"
              onClick={() => setOpen(false)}
              className="text-sm font-semibold text-rust hover:text-rust-light transition-colors"
            >
              Visa alla &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
