import { describe, expect, it } from 'vitest'
import type { ActiveRecurringPayment } from '../types'
import { billTimelineStatus } from './billTimelineStatus'

const bill = (status: ActiveRecurringPayment['status']) => ({ status }) as ActiveRecurringPayment

describe('billTimelineStatus', () => {
  it('shades one hue by payment progress', () => {
    expect(billTimelineStatus([bill('Paid')]).dot).toContain('bg-accent-ink ')
    expect(billTimelineStatus([bill('SettledByLoanPayoff')]).label).toBe('Paid')
    expect(billTimelineStatus([bill('PartiallyPaid')]).dot).toContain('bg-accent-ink/60')
    expect(billTimelineStatus([bill('Pending')]).dot).toContain('bg-accent-ink/25')
  })

  it('gives a stacked date the part-paid shade even when every bill is paid', () => {
    const stacked = billTimelineStatus([bill('Paid'), bill('Paid')])
    expect(stacked.label).toBe('Multiple bills')
    expect(stacked.dot).toBe(billTimelineStatus([bill('PartiallyPaid')]).dot)
  })
})
