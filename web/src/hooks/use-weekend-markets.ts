'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/query-keys'

export type WeekendMarket = {
  id: string
  name: string
  city: string | null
  day: number              // 0=Sun..6=Sat
  openTime: string         // "11:00"
  closeTime: string        // "18:00"
}

/** Returnera fre/lör/sön för den aktuella helgen — på fredag-söndag
 *  räknas pågående helg, på mån-tors räknas den kommande.
 */
export function upcomingWeekend(now = new Date()): { fri: Date; sat: Date; sun: Date; weekNo: number } {
  const d = new Date(now)
  const dow = d.getDay() // 0=Sun..6=Sat
  // Fri=5, Sat=6, Sun=0. Distance back to the anchor Friday of the
  // current or upcoming weekend:
  //   Mon-Thu (1..4) → kommande fre   = 5 - dow
  //   Fri (5)        → idag           = 0
  //   Sat (6)        → igår           = -1
  //   Sun (0)        → i förrgår       = -2
  const daysToFri = dow >= 1 && dow <= 5 ? 5 - dow : dow === 6 ? -1 : -2
  const fri = new Date(d)
  fri.setDate(d.getDate() + daysToFri)
  fri.setHours(0, 0, 0, 0)
  const sat = new Date(fri); sat.setDate(fri.getDate() + 1)
  const sun = new Date(fri); sun.setDate(fri.getDate() + 2)
  const jan4 = new Date(fri.getFullYear(), 0, 4)
  const weekNo = Math.ceil((((fri.getTime() - jan4.getTime()) / 86400000) + jan4.getDay() + 1) / 7)
  return { fri, sat, sun, weekNo }
}

export function useWeekendMarkets() {
  return useQuery({
    queryKey: queryKeys.admin.socialWeekend(),
    queryFn: async (): Promise<{ markets: WeekendMarket[]; weekNo: number }> => {
      const { weekNo } = upcomingWeekend()
      // Open on Fri(5)/Sat(6)/Sun(0). Query opening_hour_rules (weekly type)
      // joined to flea_markets.
      const { data, error } = await supabase
        .from('opening_hour_rules')
        .select('day_of_week, open_time, close_time, flea_market_id, flea_markets(id, name, city, is_deleted, status)')
        .eq('type', 'weekly')
        .in('day_of_week', [0, 5, 6])
      if (error) throw error

      const markets: WeekendMarket[] = []
      for (const row of (data ?? [])) {
        const m = (row as unknown as { flea_markets: { id: string; name: string; city: string | null; is_deleted: boolean; status: string | null } }).flea_markets
        if (!m || m.is_deleted || m.status === 'closed') continue
        markets.push({
          id: m.id,
          name: m.name,
          city: m.city,
          day: row.day_of_week as number,
          openTime: (row.open_time as string).slice(0, 5),
          closeTime: (row.close_time as string).slice(0, 5),
        })
      }
      // Sort: Fri, Sat, Sun; name A-Z
      const dayOrder: Record<number, number> = { 5: 0, 6: 1, 0: 2 }
      markets.sort((a, b) => (dayOrder[a.day] - dayOrder[b.day]) || a.name.localeCompare(b.name, 'sv'))
      return { markets, weekNo }
    },
    staleTime: 5 * 60 * 1000,
  })
}
