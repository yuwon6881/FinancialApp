import { describe, expect, it } from 'vitest'
import { formatDateForApi, getCycleRangeDates, getCycleYearAndMonthForDate } from '../../lib/cycle'
import { readFixture } from './runParity'

interface RangeCase {
  id: string
  why: string
  input: {
    kind: 'range'
    year: number
    monthIndex: number
    cycleDay: number
  }
  expected: {
    startDate: string
    endDate: string
  }
}

interface ForDateCase {
  id: string
  why: string
  input: {
    kind: 'forDate'
    date: string
    cycleDay: number
  }
  expected: {
    year: number
    monthIndex: number
  }
}

type CycleMathCase = RangeCase | ForDateCase

describe('cycle math parity', () => {
  const cases = readFixture<CycleMathCase>('cycle-math')

  for (const item of cases) {
    it(`[${item.id}] ${item.why}`, () => {
      if (item.input.kind === 'range') {
        const { start, end } = getCycleRangeDates(item.input.year, item.input.monthIndex, item.input.cycleDay)
        const expected = item.expected as RangeCase['expected']
        expect(formatDateForApi(start)).toBe(expected.startDate)
        expect(formatDateForApi(end)).toBe(expected.endDate)
      } else if (item.input.kind === 'forDate') {
        const [y, m, d] = item.input.date.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        const actual = getCycleYearAndMonthForDate(date, item.input.cycleDay)
        const expected = item.expected as ForDateCase['expected']
        expect(actual.year).toBe(expected.year)
        expect(actual.monthIndex).toBe(expected.monthIndex)
      }
    })
  }
})
