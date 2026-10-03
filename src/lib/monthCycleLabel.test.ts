import { describe, expect, it } from 'vitest'
import { getMonthCycleLabel } from './monthCycleLabel'

describe('getMonthCycleLabel', () => {
  it('names the spending cycle and rolls a three-cycle plan across years', () => {
    expect(getMonthCycleLabel('2026-07')).toBe('Jul 2026 cycle')
    expect(getMonthCycleLabel('2026-06', 3)).toBe('Sep 2026 cycle')
    expect(getMonthCycleLabel('2026-08', 3)).toBe('Nov 2026 cycle')
    expect(getMonthCycleLabel('2026-11', 3)).toBe('Feb 2027 cycle')
  })

  it.each(['2026-00', '2026-13', 'invalid', '2026-7'])('does not invent a cycle for %s', key => {
    expect(getMonthCycleLabel(key, 3)).toBeUndefined()
  })
})
