'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, BookingWithDetails, FleaMarket, OrganizerStats } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'

export default function BookingsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [myMarkets, setMyMarkets] = useState<FleaMarket[]>([])
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [stats, setStats] = useState<OrganizerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth')
      return
    }
    loadData()
  }, [user, authLoading])

  async function loadData() {
    if (!user) return
    try {
      setLoading(true)
      const markets = await api.fleaMarkets.listByOrganizer(user.id)
      setMyMarkets(markets)

      // Load bookings for all user's markets
      const allBookings = await Promise.all(
        markets.map((m) => api.bookings.listByMarket(m.id)),
      )
      setBookings(allBookings.flat())

      const s = await api.organizers.stats(user.id)
      setStats(s)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateStatus(
    bookingId: string,
    status: 'confirmed' | 'denied',
  ) {
    setUpdatingId(bookingId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers = { Authorization: `Bearer ${session?.access_token}` }

      if (status === 'confirmed') {
        const res = await supabase.functions.invoke('stripe-payment-capture', {
          body: { bookingId },
          headers,
        })
        if (res.error) throw new Error(res.data?.error || 'Capture failed')
      } else {
        const res = await supabase.functions.invoke('stripe-payment-cancel', {
          body: { bookingId, newStatus: 'denied' },
          headers,
        })
        if (res.error) throw new Error(res.data?.error || 'Cancel failed')
      }

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status } : b)),
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setUpdatingId(null)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <FyndstigenLogo size={40} className="text-rust animate-bob" />
      </div>
    )
  }

  const pending = bookings.filter((b) => b.status === 'pending')
  const confirmed = bookings.filter((b) => b.status === 'confirmed')

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 text-sm text-espresso/60 hover:text-espresso transition-colors mb-6"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Tillbaka till profil
      </Link>

      <h1 className="font-display text-2xl font-bold mb-2">Bokningar</h1>
      <p className="text-sm text-espresso/65 mb-8">
        Hantera bokningsförfrågningar för dina loppisar.
      </p>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8 animate-fade-up">
          <div className="vintage-card p-5 text-center">
            <p className="font-display text-2xl font-bold text-rust">
              {stats.total_bookings}
            </p>
            <p className="text-xs text-espresso/60 mt-1">Bokningar</p>
          </div>
          <div className="vintage-card p-5 text-center">
            <p className="font-display text-2xl font-bold text-forest">
              {stats.total_revenue_sek} kr
            </p>
            <p className="text-xs text-espresso/60 mt-1">Total intäkt</p>
          </div>
          <div className="vintage-card p-5 text-center">
            <p className="font-display text-2xl font-bold text-mustard">
              {stats.market_count}
            </p>
            <p className="text-xs text-espresso/60 mt-1">Loppisar</p>
          </div>
        </div>
      )}

      {/* Pending bookings */}
      {pending.length > 0 && (
        <div className="mb-8 animate-fade-up delay-1">
          <h2 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
            Väntar på svar
            <span className="bg-rust text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {pending.length}
            </span>
          </h2>
          <div className="space-y-3">
            {pending.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onConfirm={() => handleUpdateStatus(booking.id, 'confirmed')}
                onDeny={() => handleUpdateStatus(booking.id, 'denied')}
                updating={updatingId === booking.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Confirmed bookings */}
      {confirmed.length > 0 && (
        <div className="mb-8 animate-fade-up delay-2">
          <h2 className="font-display font-bold text-lg mb-3">Bekräftade</h2>
          <div className="space-y-3">
            {confirmed.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {bookings.length === 0 && (
        <div className="vintage-card p-10 text-center animate-fade-up">
          <FyndstigenLogo size={48} className="text-espresso/15 mx-auto mb-3" />
          <h2 className="font-display text-lg font-bold">
            Inga bokningar ännu
          </h2>
          <p className="text-sm text-espresso/60 mt-2 max-w-sm mx-auto">
            När besökare börjar boka bord på dina loppisar dyker de upp här.
          </p>
        </div>
      )}
    </div>
  )
}

function BookingCard({
  booking,
  onConfirm,
  onDeny,
  updating,
}: {
  booking: BookingWithDetails
  onConfirm?: () => void
  onDeny?: () => void
  updating?: boolean
}) {
  const bookerName =
    [booking.booker?.first_name, booking.booker?.last_name]
      .filter(Boolean)
      .join(' ') || 'Anonym'

  const statusColors = {
    pending: 'text-mustard',
    confirmed: 'text-forest',
    denied: 'text-error',
    cancelled: 'text-espresso/30',
  }

  const statusLabels = {
    pending: 'Väntar',
    confirmed: 'Bekräftad',
    denied: 'Nekad',
    cancelled: 'Avbokad',
  }

  return (
    <div className="vintage-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{bookerName}</p>
            <span className={`stamp text-xs ${statusColors[booking.status]}`}>
              {statusLabels[booking.status]}
            </span>
            {booking.payment_status && (
              <span className="text-xs text-espresso/30">
                {booking.payment_status === 'requires_capture' && '(reserverat)'}
                {booking.payment_status === 'captured' && '(betald)'}
                {booking.payment_status === 'cancelled' && '(återbetald)'}
                {booking.payment_status === 'failed' && '(misslyckad)'}
              </span>
            )}
          </div>
          <p className="text-xs text-espresso/60 mt-1">
            {booking.market_table?.label} &middot;{' '}
            {new Date(booking.booking_date).toLocaleDateString('sv-SE', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </p>
          {booking.message && (
            <p className="text-sm text-espresso/60 mt-2 italic">
              &ldquo;{booking.message}&rdquo;
            </p>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="font-display font-bold text-rust">
            {booking.price_sek} kr
          </p>
          <p className="text-xs text-espresso/30 mt-0.5">
            avg. {booking.commission_sek} kr
          </p>
        </div>
      </div>

      {/* Action buttons for pending */}
      {booking.status === 'pending' && onConfirm && onDeny && (
        <div className="flex gap-2 mt-4 pt-3 border-t border-cream-warm">
          <button
            onClick={onConfirm}
            disabled={updating}
            className="flex-1 h-9 rounded-lg bg-forest text-white text-xs font-bold hover:bg-forest-light transition-colors disabled:opacity-50"
          >
            {updating ? '...' : 'Godkänn'}
          </button>
          <button
            onClick={onDeny}
            disabled={updating}
            className="flex-1 h-9 rounded-lg bg-espresso/5 text-espresso/60 text-xs font-bold hover:bg-espresso/10 transition-colors disabled:opacity-50"
          >
            Neka
          </button>
        </div>
      )}
    </div>
  )
}
