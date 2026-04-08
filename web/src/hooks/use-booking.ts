'use client'

import { useEffect, useState } from 'react'
import { api, MarketTable } from '@/lib/api'

type BookingState = {
  selectedTable: MarketTable | null
  date: string
  message: string
  status: 'idle' | 'saving' | 'done' | 'error'
  bookedDates: string[]
  selectTable: (table: MarketTable | null) => void
  setDate: (date: string) => void
  setMessage: (msg: string) => void
  submit: (fleaMarketId: string, userId: string) => Promise<void>
}

export function useBooking(): BookingState {
  const [selectedTable, setSelectedTable] = useState<MarketTable | null>(null)
  const [date, setDate] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [bookedDates, setBookedDates] = useState<string[]>([])

  useEffect(() => {
    if (!selectedTable) {
      setBookedDates([])
      return
    }
    api.bookings.availableDates(selectedTable.id).then(setBookedDates).catch(() => {})
  }, [selectedTable?.id])

  async function submit(fleaMarketId: string, userId: string) {
    if (!selectedTable || !date) return
    setStatus('saving')
    try {
      await api.bookings.create({
        marketTableId: selectedTable.id,
        fleaMarketId,
        bookedBy: userId,
        bookingDate: date,
        priceSek: selectedTable.price_sek,
        message: message || undefined,
      })
      setStatus('done')
      setSelectedTable(null)
      setDate('')
      setMessage('')
    } catch {
      setStatus('error')
    }
  }

  return {
    selectedTable,
    date,
    message,
    status,
    bookedDates,
    selectTable: setSelectedTable,
    setDate,
    setMessage,
    submit,
  }
}
