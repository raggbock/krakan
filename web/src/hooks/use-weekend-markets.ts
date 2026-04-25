'use client'

import { useQuery } from '@tanstack/react-query'
import { useDeps } from '@/providers/deps-provider'
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
  const { markets } = useDeps()
  return useQuery({
    queryKey: queryKeys.admin.socialWeekend(),
    queryFn: async (): Promise<{ markets: WeekendMarket[]; weekNo: number }> => {
      const { weekNo } = upcomingWeekend()
      const slots = await markets.weekendOpen()
      const out: WeekendMarket[] = slots.map((s) => ({
        id: s.fleaMarketId,
        name: s.name,
        city: s.city,
        day: s.dayOfWeek,
        openTime: s.openTime,
        closeTime: s.closeTime,
      }))
      const dayOrder: Record<number, number> = { 5: 0, 6: 1, 0: 2 }
      out.sort((a, b) => (dayOrder[a.day] - dayOrder[b.day]) || a.name.localeCompare(b.name, 'sv'))
      return { markets: out, weekNo }
    },
    staleTime: 5 * 60 * 1000,
  })
}
