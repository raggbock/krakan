'use client'

import { useEffect, useMemo, useState } from 'react'
import { api, MarketTable } from '@/lib/api'
import { calculateCommission, COMMISSION_RATE, validateBookingDate } from '@fyndstigen/shared'

type DateValidation = { valid: boolean; error?: string }

type BookingHook = {
  // State
  selectedTable: MarketTable | null
  date: string
  message: string
  bookedDates: string[]

  // Setters
  selectTable: (table: MarketTable | null) => void
  setDate: (date: string) => void
  setMessage: (msg: string) => void

  // Computed
  dateValidation: DateValidation
  commission: number
  totalPrice: number
  canSubmit: boolean

  // Mutation
  submit: () => Promise<void>
  isSubmitting: boolean
  isDone: boolean
  submitError: string | null
  reset: () => void
}

export function useBooking(marketId: string, userId: string | undefined): BookingHook {
  const [selectedTable, setSelectedTable] = useState<MarketTable | null>(null)
  const [date, setDate] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [bookedDates, setBookedDates] = useState<string[]>([])

  // Fetch booked dates when table changes
  useEffect(() => {
    if (!selectedTable) {
      setBookedDates([])
      return
    }
    api.bookings.availableDates(selectedTable.id).then(setBookedDates).catch(() => setBookedDates([]))
  }, [selectedTable?.id])

  // Computed: date validation
  const today = new Date().toISOString().slice(0, 10)
  const dateValidation = useMemo<DateValidation>(() => {
    if (!date) return { valid: false }
    return validateBookingDate(date, bookedDates, today)
  }, [date, bookedDates, today])

  // Computed: pricing
  const price = selectedTable?.price_sek ?? 0
  const commission = calculateCommission(price, COMMISSION_RATE)
  const totalPrice = price + commission

  // Computed: can submit
  const canSubmit = !!selectedTable && !!date && dateValidation.valid && !!userId && !isSubmitting

  async function submit() {
    if (!canSubmit || !selectedTable) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await api.bookings.create({
        marketTableId: selectedTable.id,
        fleaMarketId: marketId,
        bookedBy: userId!,
        bookingDate: date,
        priceSek: price,
        message: message || undefined,
      })
      setIsDone(true)
      setSelectedTable(null)
      setDate('')
      setMessage('')
    } catch {
      setSubmitError('Något gick fel. Försök igen.')
    } finally {
      setIsSubmitting(false)
    }
  }

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
    selectedTable,
    date,
    message,
    bookedDates,
    selectTable: setSelectedTable,
    setDate,
    setMessage,
    dateValidation,
    commission,
    totalPrice,
    canSubmit,
    submit,
    isSubmitting,
    isDone,
    submitError,
    reset,
  }
}
