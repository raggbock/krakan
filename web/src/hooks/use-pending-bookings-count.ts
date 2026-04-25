'use client'

import { useEffect, useState } from 'react'
import { useDeps } from '@/providers/deps-provider'

export function usePendingBookingsCount(userId: string | undefined) {
  const { bookings } = useDeps()
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    let cancelled = false
    bookings
      .pendingCountForOrganizer(userId)
      .then((c) => { if (!cancelled) { setCount(c); setLoading(false) } })
      .catch(() => { if (!cancelled) { setCount(0); setLoading(false) } })
    return () => { cancelled = true }
  }, [userId, bookings])

  return { count, loading }
}
