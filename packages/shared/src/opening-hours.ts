export type OpeningHoursEntry = {
  day_of_week: number | null
  date: string | null
  open_time: string
  close_time: string
}

export type OpeningHoursResult = {
  isOpen: boolean
  hours: { open_time: string; close_time: string } | null
}

/**
 * Check if a market is open on a given date.
 * Specific date entries take priority over day_of_week entries.
 *
 * @param entries - The market's opening hours from the database
 * @param dateStr - ISO date string (YYYY-MM-DD) to check against
 */
export function checkOpeningHours(
  entries: OpeningHoursEntry[],
  dateStr: string,
): OpeningHoursResult {
  if (entries.length === 0) {
    return { isOpen: false, hours: null }
  }

  // Check for specific date match first (higher priority)
  const dateMatch = entries.find(
    (e) => e.date !== null && e.date === dateStr,
  )
  if (dateMatch) {
    return {
      isOpen: true,
      hours: { open_time: dateMatch.open_time, close_time: dateMatch.close_time },
    }
  }

  // Fall back to day_of_week match
  const date = new Date(dateStr + 'T12:00:00') // noon to avoid timezone issues
  const dayOfWeek = date.getDay() // 0=Sunday, 6=Saturday

  const dayMatch = entries.find(
    (e) => e.day_of_week !== null && e.day_of_week === dayOfWeek,
  )
  if (dayMatch) {
    return {
      isOpen: true,
      hours: { open_time: dayMatch.open_time, close_time: dayMatch.close_time },
    }
  }

  return { isOpen: false, hours: null }
}
