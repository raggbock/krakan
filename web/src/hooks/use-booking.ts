'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js'
import type { StripeCardElement } from '@stripe/stripe-js'
import { api, bookingService, MarketTable } from '@/lib/api'
import { isFreePriced } from '@fyndstigen/shared'
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
  commission: number
  totalPrice: number
  isFree: boolean
  canSubmit: boolean
  submit: () => Promise<void>
  isSubmitting: boolean
  isDone: boolean
  submitError: string | null
  reset: () => void
}

export function useBooking(marketId: string, userId: string | undefined): BookingHook {
  const posthog = usePostHog()
  const stripe = useStripe()
  const elements = useElements()
  const [selectedTable, setSelectedTable] = useState<MarketTable | null>(null)
  const [date, setDate] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
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
    return bookingService.validateDate(date, bookedDates, today)
  }, [date, bookedDates, today])

  const price = selectedTable?.price_sek ?? 0
  const isFree = isFreePriced(price)
  const { commission, total: totalPrice } = bookingService.calculateTotal(price)

  const canSubmit = !!selectedTable && !!date && dateValidation.valid && !!userId && !isSubmitting

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
      setSubmitError(err instanceof Error ? err.message : 'Något gick fel. Försök igen.')
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
    dateValidation, commission, totalPrice, isFree, canSubmit,
    submit, isSubmitting, isDone, submitError, reset,
  }
}
