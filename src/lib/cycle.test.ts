import { describe, expect, it } from 'vitest'
import { addMonthsClamped, getCycleRangeDates } from './cycle'

describe('addMonthsClamped', () => {
  it('mirrors AddMonths at the end of a shorter month', () => {
    const result = addMonthsClamped(new Date(2025, 0, 31, 12, 30), 1)

    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(1)
    expect(result.getDate()).toBe(28)
    expect(result.getHours()).toBe(12)
    expect(result.getMinutes()).toBe(30)
  })

  it('uses clamped AddMonths for a day-31 cycle boundary', () => {
    const { start, end } = getCycleRangeDates(2025, 1, 31)

    expect([start.getFullYear(), start.getMonth() + 1, start.getDate()]).toEqual([2025, 1, 31])
    expect([end.getFullYear(), end.getMonth() + 1, end.getDate()]).toEqual([2025, 2, 27])
  })
})
