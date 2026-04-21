'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function usePendingBookingsCount(userId: string | undefined) {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      const { data: markets } = await supabase
        .from('flea_markets')
        .select('id')
        .eq('organizer_id', userId)
        .eq('is_deleted', false)
      if (cancelled) return
      const ids = (markets ?? []).map((m) => m.id)
      if (ids.length === 0) {
        setCount(0)
        setLoading(false)
        return
      }
      const { count: c } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .in('flea_market_id', ids)
        .eq('status', 'pending')
      if (cancelled) return
      setCount(c ?? 0)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  return { count, loading }
}
