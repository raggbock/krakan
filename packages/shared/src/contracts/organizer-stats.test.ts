import { describe, it, expect } from 'vitest'
import { OrganizerStatsInput, OrganizerStatsOutput } from './organizer-stats'

describe('OrganizerStatsInput', () => {
  it('accepts a valid organizer_id', () => {
    const result = OrganizerStatsInput.safeParse({ organizer_id: 'user-abc' })
    expect(result.success).toBe(true)
  })

  it('rejects empty organizer_id', () => {
    const result = OrganizerStatsInput.safeParse({ organizer_id: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing organizer_id', () => {
    const result = OrganizerStatsInput.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('OrganizerStatsOutput', () => {
  it('accepts empty markets array', () => {
    const result = OrganizerStatsOutput.safeParse({ markets: [] })
    expect(result.success).toBe(true)
  })

  it('accepts a valid markets array', () => {
    const result = OrganizerStatsOutput.safeParse({
      markets: [
        {
          flea_market_id: 'market-1',
          name: 'Loppis Centrum',
          pageviews_30d: 100,
          pageviews_total: 500,
          bookings_initiated_30d: 10,
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing name in market row', () => {
    const result = OrganizerStatsOutput.safeParse({
      markets: [
        {
          flea_market_id: 'market-1',
          pageviews_30d: 100,
          pageviews_total: 500,
          bookings_initiated_30d: 10,
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('round-trips through JSON', () => {
    const sample = {
      markets: [
        {
          flea_market_id: 'market-1',
          name: 'Loppis',
          pageviews_30d: 50,
          pageviews_total: 200,
          bookings_initiated_30d: 5,
        },
      ],
    }
    const parsed = OrganizerStatsOutput.parse(JSON.parse(JSON.stringify(sample)))
    expect(parsed).toEqual(sample)
  })
})
