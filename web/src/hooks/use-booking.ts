'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStripe, useElements } from '@stripe/react-stripe-js'
import { bookingService } from '@/lib/booking-service'
import type { MarketTable } from '@fyndstigen/shared'
import { isFreePriced, messageFor } from '@fyndstigen/shared'
import type { AppError, OpeningHoursContext } from '@fyndstigen/shared'
import { usePostHog } from 'posthog-js/react'
import { useDeps } from '@/providers/deps-provider'
import { resolvePaymentGateway } from '@/lib/adapters/payment-gateway-factory'

type BookingHook = {
  selectedTable: MarketTable | null
  date: string
  message: string
  bookedDates: string[]
  selectTable: (table: MarketTable | null) => void
  setDate: (date: string) => void
  setMessage: (msg: string) => void
  /** Swedish user-facing validation message, or null when date is valid/empty */
  validationError: string | null
  commission: number
  totalPrice: number
  isFree: boolean
  canSubmit: boolean
  submit: () => Promise<void>
  isSubmitting: boolean
  isDone: boolean
  /** Typed AppError on submit failure; use messageFor() to render */
  submitError: AppError | null
  reset: () => void
}

export function useBooking(
  marketId: string,
  marketName?: string,
  userId?: string,
  openingHours?: OpeningHoursContext,
): BookingHook {
  const posthog = usePostHog()
  const stripe = useStripe()
  const elements = useElements()
  const { bookings } = useDeps()
  const [selectedTable, setSelectedTable] = useState<MarketTable | null>(null)
  const [date, setDate] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [submitError, setSubmitError] = useState<AppError | null>(null)
  const [bookedDates, setBookedDates] = useState<string[]>([])

  const fetchIdRef = useRef(0)
  const selectedTableId = selectedTable?.id ?? null
  useEffect(() => {
    if (!selectedTableId) {
      setBookedDates([])
      return
    }
    const id = ++fetchIdRef.current
    bookings.availableDates(selectedTableId)
      .then((dates) => { if (id === fetchIdRef.current) setBookedDates(dates) })
      .catch(() => { if (id === fetchIdRef.current) setBookedDates([]) })
  }, [selectedTableId, bookings])

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const dateValidation = useMemo(() => {
    if (!date) return { valid: false }
    return bookingService.validateDate(date, bookedDates, today, openingHours)
  }, [date, bookedDates, today, openingHours])

  const validationError =
    date && !dateValidation.valid && 'code' in dateValidation
      ? messageFor(dateValidation.code, dateValidation.params)
      : null

  const price = selectedTable?.price_sek ?? 0
  const isFree = isFreePriced(price)
  const { commission, total: totalPrice } = bookingService.calculateTotal(price)

  const canSubmit =
    !!selectedTable && !!date && dateValidation.valid && !!userId && !isSubmitting && !isDone

  const submit = useCallback(async () => {
    if (!canSubmit || !selectedTable) return
    setSubmitError(null)

    const priceSek = selectedTable.price_sek
    const payment = resolvePaymentGateway({ stripe, elements })

    const stream = bookingService.book(
      {
        marketTableId: selectedTable.id,
        fleaMarketId: marketId,
        bookingDate: date,
        message: message || undefined,
        tableLabel: selectedTable.label,
        marketName: marketName ?? '',
        priceSek,
      },
      { payment },
    )

    for await (const evt of stream) {
      switch (evt.type) {
        case 'submitted':
          setIsSubmitting(true)
          posthog?.capture('booking_submitted', {
            market_id: marketId,
            table_ids: [selectedTable.id],
            total_amount_ore: isFreePriced(priceSek) ? 0 : bookingService.calculateTotal(priceSek).total * 100,
            is_free: isFreePriced(priceSek),
          })
          break

        case 'created':
          // bookingId and amountOre are available here if needed for future telemetry
          break

        case 'payment-required':
          // payment-required is informational; the generator awaits confirmCardPayment next
          break

        case 'payment-confirmed':
          posthog?.capture('booking_payment_completed', {
            booking_id: evt.bookingId,
            market_id: marketId,
            amount_ore: evt.amountOre,
          })
          break

        case 'succeeded':
          posthog?.capture('booking_succeeded', {
            booking_id: evt.bookingId,
            market_id: marketId,
            requires_payment: evt.requiresPayment,
          })
          setIsDone(true)
          setSelectedTable(null)
          setDate('')
          setMessage('')
          break

        case 'failed':
          setSubmitError(evt.error)
          posthog?.capture('booking_failed', {
            market_id: marketId,
            stage: evt.stage,
            reason: evt.error.code,
          })
          break

        default: {
          // Exhaustiveness check — TS will error if a new variant is unhandled
          const _exhaustive: never = evt
          void _exhaustive
          break
        }
      }
    }

    setIsSubmitting(false)
  }, [canSubmit, selectedTable, stripe, elements, marketId, marketName, date, message, posthog])

  function reset() {
    setSelectedTable(null)
    setDate('')
    setMessage('')
    setIsSubmitting(false)
    setIsDone(false)
    setSubmitError(null)
    setBookedDates([])
  }

  return {
    selectedTable, date, message, bookedDates,
    selectTable: setSelectedTable, setDate, setMessage,
    validationError,
    commission, totalPrice, isFree, canSubmit,
    submit, isSubmitting, isDone, submitError, reset,
  }
}
