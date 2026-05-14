'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Elements, CardElement } from '@stripe/react-stripe-js'
import type { MarketTableView } from '@fyndstigen/shared'
import { useAuth } from '@/lib/auth/auth-context'
import { useBooking } from '@/hooks/use-booking'
import type { OpeningHoursContext } from '@fyndstigen/shared'
import { isFreePriced, messageFor } from '@fyndstigen/shared'
import { getStripe } from '@/lib/stripe/stripe'
import { useFlag } from '@/lib/flags'
import { usePostHog } from 'posthog-js/react'

function BookableTablesInner({
  fleaMarketId,
  fleaMarketName,
  tables,
  openingHours,
}: {
  fleaMarketId: string
  fleaMarketName: string
  tables: MarketTableView[]
  openingHours?: OpeningHoursContext
}) {
  const { user } = useAuth()
  const posthog = usePostHog()
  const booking = useBooking(fleaMarketId, fleaMarketName, user?.id, openingHours)

  // ── Booking funnel sub-events ────────────────────────────────────────────
  // Each fires at most once per session (ref-guarded so re-renders don't spam).
  const tableSelectedFiredRef = useRef<string | null>(null)
  const dateSelectedFiredRef = useRef<string | null>(null)
  const formCompletedFiredRef = useRef<string | null>(null)

  // booking_table_selected — fires once per table pick
  useEffect(() => {
    if (!booking.selectedTable) return
    const key = `${fleaMarketId}:${booking.selectedTable.id}`
    if (tableSelectedFiredRef.current === key) return
    tableSelectedFiredRef.current = key
    posthog?.capture('booking_table_selected', {
      market_id: fleaMarketId,
      table_id: booking.selectedTable.id,
      price_sek: booking.selectedTable.priceSek,
      is_free: isFreePriced(booking.selectedTable.priceSek),
    })
  }, [booking.selectedTable, fleaMarketId, posthog])

  // booking_date_selected — fires once per (table, date) when date passes validation
  useEffect(() => {
    if (!booking.selectedTable || !booking.date || booking.validationError) return
    const key = `${fleaMarketId}:${booking.selectedTable.id}:${booking.date}`
    if (dateSelectedFiredRef.current === key) return
    dateSelectedFiredRef.current = key
    posthog?.capture('booking_date_selected', {
      market_id: fleaMarketId,
      table_id: booking.selectedTable.id,
    })
  }, [booking.selectedTable, booking.date, booking.validationError, fleaMarketId, posthog])

  // booking_form_completed — fires once when canSubmit first becomes true
  useEffect(() => {
    if (!booking.canSubmit || !booking.selectedTable) return
    const key = `${fleaMarketId}:${booking.selectedTable.id}:${booking.date}`
    if (formCompletedFiredRef.current === key) return
    formCompletedFiredRef.current = key
    posthog?.capture('booking_form_completed', {
      market_id: fleaMarketId,
      table_id: booking.selectedTable.id,
      has_message: booking.message.trim().length > 0,
    })
  }, [booking.canSubmit, booking.selectedTable, booking.date, booking.message, fleaMarketId, posthog])
  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="vintage-card p-6 animate-fade-up delay-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-lavender/15 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-lavender">
            <rect x="2" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <line x1="4" y1="11" x2="4" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="12" y1="11" x2="12" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="font-display font-bold text-lg mb-1">Boka bord</h2>
          <p className="text-sm text-espresso/65 mb-4">
            Hyr en plats och sälj dina prylar här.
          </p>

          {booking.isDone && (
            <div className="bg-forest/10 text-forest rounded-xl px-4 py-3 text-sm font-medium">
              {booking.isFree
                ? 'Bokning skickad!'
                : 'Bokning skickad! Beloppet är reserverat tills arrangören svarar.'}
            </div>
          )}

          {!booking.isDone && (
          <div className="space-y-3">
            {tables.map((table) => {
              const isSelected = booking.selectedTable?.id === table.id
              return (
                <div key={table.id}>
                  <button
                    onClick={() => {
                      const next = isSelected ? null : table
                      booking.selectTable(next)
                      if (next) {
                        posthog?.capture('booking_started', {
                          market_id: fleaMarketId,
                          table_count: tables.length,
                          is_free: isFreePriced(next.priceSek),
                        })
                      }
                    }}
                    className={`w-full text-left flex items-center justify-between rounded-xl p-4 transition-all ${
                      isSelected
                        ? 'bg-rust/8 border border-rust/20'
                        : 'bg-parchment hover:bg-cream-warm border border-transparent'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-sm">{table.label}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-espresso/60">
                        {table.sizeDescription && <span>{table.sizeDescription}</span>}
                        {table.description && <span>&middot; {table.description}</span>}
                      </div>
                    </div>
                    <span className="font-display font-bold text-rust">
                      {table.priceSek === 0 ? 'Gratis' : `${table.priceSek} kr`}
                    </span>
                  </button>

                  {isSelected && (
                    <div className="mt-3 ml-4 pl-4 border-l-2 border-rust/15 space-y-3 animate-fade-in">
                      <div>
                        <label className="text-xs font-semibold text-espresso/60 block mb-1">
                          Datum
                        </label>
                        <input
                          type="date"
                          value={booking.date}
                          onChange={(e) => booking.setDate(e.target.value)}
                          className="w-full h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all"
                        />
                        {booking.validationError && (
                          <p className="text-xs text-error mt-1">
                            {booking.validationError}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-espresso/60 block mb-1">
                          Meddelande (valfritt)
                        </label>
                        <textarea
                          value={booking.message}
                          onChange={(e) => booking.setMessage(e.target.value)}
                          rows={2}
                          placeholder="Berätta vad du säljer..."
                          className="w-full rounded-lg bg-card px-3 py-2 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all resize-none placeholder:text-espresso/55"
                        />
                      </div>
                      {!booking.isFree && (
                        <div>
                          <label className="text-xs font-semibold text-espresso/60 block mb-1">
                            Kortuppgifter
                          </label>
                          <div className="rounded-lg bg-card px-3 py-2.5 border border-cream-warm focus-within:border-rust/40 transition-all">
                            <CardElement
                              options={{
                                style: {
                                  base: {
                                    fontSize: '14px',
                                    color: '#3D2B1F',
                                    '::placeholder': { color: '#3D2B1F40' },
                                  },
                                  invalid: { color: '#C0392B' },
                                },
                              }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-espresso/60">
                          {booking.isFree
                            ? 'Gratis'
                            : `${booking.totalPrice} kr (inkl ${booking.commission} kr avgift)`}
                        </p>
                        {user ? (
                          <button
                            onClick={booking.submit}
                            disabled={!booking.canSubmit}
                            className="bg-rust text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-rust-light transition-colors disabled:opacity-40"
                          >
                            {booking.isSubmitting ? 'Behandlar...' : booking.isFree ? 'Boka' : 'Boka & reservera'}
                          </button>
                        ) : (
                          <Link href="/auth" className="text-rust text-xs font-semibold">
                            Logga in för att boka
                          </Link>
                        )}
                      </div>
                      {booking.submitError && (
                        <p className="text-xs text-error">{messageFor(booking.submitError)}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function BookableTablesCard({
  fleaMarketId,
  fleaMarketName,
  tables,
  openingHours,
}: {
  fleaMarketId: string
  fleaMarketName: string
  tables: MarketTableView[]
  openingHours?: OpeningHoursContext
}) {
  const paymentsEnabled = useFlag('payments')
  // When payments are off, only show free tables
  const visibleTables = paymentsEnabled
    ? tables
    : tables.filter((t) => t.priceSek === 0)

  if (visibleTables.length === 0) return null

  return (
    <Elements stripe={getStripe()}>
      <BookableTablesInner fleaMarketId={fleaMarketId} fleaMarketName={fleaMarketName} tables={visibleTables} openingHours={openingHours} />
    </Elements>
  )
}
