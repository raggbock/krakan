'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js'
import type { StripeCardElement } from '@stripe/stripe-js'
import { api, bookingService, MarketTable } from '@/lib/api'
import { isFreePriced, toAppError } from '@fyndstigen/shared'
import type { AppError, OpeningHoursContext } from '@fyndstigen/shared'
import { usePostHog } from 'posthog-js/react'

type DateValidation = { valid: boolean; error?: string }

type BookingHook = {
  selectedTable: MarketTable | null
  date: string
  message: string
  bookedDates: string[]
  selectTable: (table: MarketTable | null) => void
  setDate: (date: string) => void
  setMessage: (msg: string) => void
  dateValidation: DateValidation
  /** True if the selected date is already in bookedDates */
  dateConflict: boolean
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

export function useBooking(marketId: string, userId: string | undefined, openingHours?: OpeningHoursContext): BookingHook {
  const posthog = usePostHog()
  const stripe = useStripe()
  const elements = useElements()
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
    api.bookings.availableDates(selectedTableId)
      .then((dates) => { if (id === fetchIdRef.current) setBookedDates(dates) })
      .catch(() => { if (id === fetchIdRef.current) setBookedDates([]) })
  }, [selectedTableId])

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const dateValidation = useMemo<DateValidation>(() => {
    if (!date) return { valid: false }
    return bookingService.validateDate(date, bookedDates, today, openingHours)
  }, [date, bookedDates, today, openingHours])

  const dateConflict = date ? bookedDates.includes(date) : false
  const validationError = date && dateValidation.error ? dateValidation.error : null

  const price = selectedTable?.price_sek ?? 0
  const isFree = isFreePriced(price)
  const { commission, total: totalPrice } = bookingService.calculateTotal(price)

  const canSubmit =
    !!selectedTable && !!date && dateValidation.valid && !!userId && !isSubmitting && !isDone

  const submit = useCallback(async () => {
    if (!canSubmit || !selectedTable) return
    setIsSubmitting(true)
    setSubmitError(null)
    posthog?.capture('booking_initiated', {
      flea_market_id: marketId,
      market_name: selectedTable.label,
      table_label: selectedTable.label,
      price_sek: selectedTable.price_sek,
      is_free: isFree,
    })
    try {
      const data = await bookingService.createWithPayment({
        marketTableId: selectedTable.id,
        fleaMarketId: marketId,
        bookingDate: date,
        message: message || undefined,
      })

      if (data.clientSecret) {
        if (!stripe || !elements) throw new Error('Stripe not loaded')
        const cardElement = elements.getElement(CardElement) as StripeCardElement | null
        if (!cardElement) throw new Error('Card element not found')

        const { error: confirmError } = await stripe.confirmCardPayment(data.clientSecret, {
          payment_method: { card: cardElement },
        })
        if (confirmError) throw new Error(confirmError.message)
      }

      setIsDone(true)
      setSelectedTable(null)
      setDate('')
      setMessage('')
    } catch (err) {
      setSubmitError(toAppError(err))
    } finally {
      setIsSubmitting(false)
    }
  }, [canSubmit, selectedTable, stripe, elements, marketId, date, message, posthog, isFree])

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
    dateValidation, dateConflict, validationError,
    commission, totalPrice, isFree, canSubmit,
    submit, isSubmitting, isDone, submitError, reset,
  }
}
