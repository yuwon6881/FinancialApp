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

  it('shows a stacked date as fully paid only when every bill on it is paid', () => {
    const stacked = billTimelineStatus([bill('Paid'), bill('Paid'), bill('SettledByLoanPayoff'), bill('Paid')])
    expect(stacked.label).toBe('Paid')
    expect(stacked.dot).toBe(billTimelineStatus([bill('Paid')]).dot)
  })

  it('shows a stacked date as part paid when only some of its bills are paid', () => {
    const partPaid = billTimelineStatus([bill('PartiallyPaid')])
    expect(billTimelineStatus([bill('Paid'), bill('Paid'), bill('Paid'), bill('Pending')])).toEqual(partPaid)
    expect(billTimelineStatus([bill('Paid'), bill('PartiallyPaid')])).toEqual(partPaid)
    expect(billTimelineStatus([bill('Pending'), bill('PartiallyPaid')])).toEqual(partPaid)
  })

  it('keeps a stacked date pending when nothing on it has been paid', () => {
    expect(billTimelineStatus([bill('Pending'), bill('Pending')])).toEqual(billTimelineStatus([bill('Pending')]))
  })

  it('ignores discarded bills when judging a stacked date', () => {
    expect(billTimelineStatus([bill('Paid'), bill('Discarded')])).toEqual(billTimelineStatus([bill('Paid')]))
    expect(billTimelineStatus([bill('Pending'), bill('Discarded')])).toEqual(billTimelineStatus([bill('Pending')]))
    expect(billTimelineStatus([bill('Discarded'), bill('Discarded')])).toEqual(billTimelineStatus([bill('Discarded')]))
  })
})
