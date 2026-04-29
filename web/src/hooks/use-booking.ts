'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStripe, useElements } from '@stripe/react-stripe-js'
import { bookingService } from '@/lib/booking-service'
import type { MarketTable } from '@fyndstigen/shared'
import { isFreePriced, toAppError, messageFor } from '@fyndstigen/shared'
import type { AppError, OpeningHoursContext } from '@fyndstigen/shared'
import { usePostHog } from 'posthog-js/react'
import { useDeps } from '@/providers/deps-provider'
import { resolvePaymentGateway } from '@/lib/adapters/payment-gateway-factory'
import { createPostHogTelemetry } from '@/lib/adapters/posthog-telemetry'

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
  marketName: string,
  userId: string | undefined,
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
    setIsSubmitting(true)
    setSubmitError(null)

    const priceSek = selectedTable.price_sek
    const isFree = isFreePriced(priceSek)
    const totalAmountOre = isFree ? 0 : bookingService.calculateTotal(priceSek).total * 100

    posthog?.capture('booking_submitted', {
      market_id: marketId,
      table_ids: [selectedTable.id],
      total_amount_ore: totalAmountOre,
      is_free: isFree,
    })

    try {
      let paymentCompleted = false
      const payment = resolvePaymentGateway({
        stripe,
        elements,
        onPaymentCompleted: () => { paymentCompleted = true },
      })

      const telemetry = createPostHogTelemetry(posthog)

      const { bookingId } = await bookingService.book(
        {
          marketTableId: selectedTable.id,
          fleaMarketId: marketId,
          bookingDate: date,
          message: message || undefined,
          tableLabel: selectedTable.label,
          marketName,
          priceSek,
        },
        { payment, telemetry },
      )

      posthog?.capture('booking_succeeded', {
        booking_id: bookingId,
        market_id: marketId,
        requires_payment: !isFree,
      })

      if (paymentCompleted) {
        posthog?.capture('booking_payment_completed', {
          booking_id: bookingId,
          market_id: marketId,
          amount_ore: totalAmountOre,
        })
      }

      setIsDone(true)
      setSelectedTable(null)
      setDate('')
      setMessage('')
    } catch (err) {
      const appErr = toAppError(err)
      setSubmitError(appErr)
      posthog?.capture('booking_failed', {
        market_id: marketId,
        stage: 'submit',
        reason: appErr.code,
      })
    } finally {
      setIsSubmitting(false)
    }
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
