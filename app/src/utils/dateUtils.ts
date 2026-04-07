import dayjs from 'dayjs'

/**
 *
 * @param {object} date - Date time you want formatted
 * @param {boolean} camelCase - Wether to return day in upper case
 * @param {boolean} split - wether to split ddd into separate output
 * @returns {object|string} if split: {day, date} else string
 */
export function formatDateTime(date, split = false, camelCase = true): any {
  const formatted = dayjs(date).format('ddd DD MMM YYYY - HH.mm')

  if (split) {
    const day: string = formatted.substring(0, 3)
    const restDate: string = formatted.substring(3)

    if (camelCase) {
      const camelCaseDay = day.toUpperCase()
      return { day: camelCaseDay, date: restDate }
    }

    return { day, date: restDate }
  }

  return formatted
}
