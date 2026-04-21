'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const CONSENT_KEY = 'fyndstigen-cookie-consent'
const REOPEN_EVENT = 'fyndstigen-cookie-reopen'

export type ConsentStatus = 'accepted' | 'declined' | null

export function getConsentStatus(): ConsentStatus {
  if (typeof window === 'undefined') return null
  const value = localStorage.getItem(CONSENT_KEY)
  if (value === 'accepted' || value === 'declined') return value
  return null
}

export function openCookieSettings() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(REOPEN_EVENT))
  }
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onReopen = () => setVisible(true)
    window.addEventListener(REOPEN_EVENT, onReopen)
    if (getConsentStatus()) return () => window.removeEventListener(REOPEN_EVENT, onReopen)
    // Defer the banner past LCP so it doesn't become the largest paint.
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    }
    const show = () => setVisible(true)
    let timeoutId: number | undefined
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(show, { timeout: 2000 })
    } else {
      timeoutId = window.setTimeout(show, 1500)
    }
    return () => {
      window.removeEventListener(REOPEN_EVENT, onReopen)
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [])

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    setVisible(false)
    window.location.reload()
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6">
      <div className="max-w-xl mx-auto vintage-card p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-espresso/70 flex-1">
          Vi använder cookies för att förbättra din upplevelse och analysera trafik.{' '}
          <Link href="/integritetspolicy" className="text-rust underline">
            Läs mer
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-espresso/60 bg-espresso/5 hover:bg-espresso/10 transition-colors"
          >
            Bara nödvändiga
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-rust hover:bg-rust-light transition-colors"
          >
            Acceptera
          </button>
        </div>
      </div>
    </div>
  )
}
