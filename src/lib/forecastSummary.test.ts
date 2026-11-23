import { describe, expect, it } from 'vitest'
import type { ForecastCycle } from '../types'
import { firstShortfalls } from './forecastSummary'

const zero = { Essentials: 0, Growth: 0, Stability: 0, Rewards: 0 }
const cycle = (label: string, closing: Partial<typeof zero>, shortBuckets: ForecastCycle['shortBuckets']): ForecastCycle => ({
  start: '2026-11-28', end: '2026-12-27', label, isCurrent: false,
  opening: zero, moneyIn: zero, moneyOut: zero, closing: { ...zero, ...closing },
  lines: [], shortBuckets, stabilityTargetReached: false,
})

describe('firstShortfalls', () => {
  it('names only the first cycle each bucket runs short, in bucket order', () => {
    const cycles = [
      cycle('Rest of this cycle', {}, []),
      cycle('Dec 2026', { Rewards: -20 }, ['Rewards']),
      cycle('Jan 2027', { Essentials: -800, Rewards: -60 }, ['Essentials', 'Rewards']),
    ]

    expect(firstShortfalls(cycles)).toEqual([
      { bucket: 'Essentials', cycleLabel: 'Jan 2027', isCurrent: false, closing: -800 },
      { bucket: 'Rewards', cycleLabel: 'Dec 2026', isCurrent: false, closing: -20 },
    ])
  })

  it('is empty when nothing runs short', () => {
    expect(firstShortfalls([cycle('Dec 2026', { Essentials: 50 }, [])])).toEqual([])
  })
})
