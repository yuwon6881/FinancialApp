import { describe, expect, it } from 'vitest'
import { loanPayoffProgress } from './loanTerms'
import type { Loan } from '../types'

const loan = (over: Partial<Loan> & { outstandingBalance?: number } = {}) => {
  const { outstandingBalance = 620, ...rest } = over
  return {
    openingPrincipal: 1620,
    isRecalculating: false,
    snapshot: { outstandingBalance },
    ...rest,
  } as Pick<Loan, 'openingPrincipal' | 'snapshot' | 'isRecalculating'>
}

describe('loanPayoffProgress', () => {
  it('measures cleared principal against the tracked opening balance', () => {
    const progress = loanPayoffProgress(loan({ outstandingBalance: 1000 }), false)

    expect(progress).toEqual({
      trackedPrincipal: 1620,
      clearedPrincipal: 620,
      percentPaid: (620 / 1620) * 100,
    })
  })

  it('reports nothing rather than 0% when the schedule is unavailable', () => {
    // A 0% bar reads as "no progress"; the truth is that the balance is not knowable.
    expect(loanPayoffProgress(loan(), true)).toBeNull()
  })

  it('reports nothing while a replay is in flight', () => {
    expect(loanPayoffProgress(loan({ isRecalculating: true }), false)).toBeNull()
  })

  it('reports nothing when there is no tracked principal to measure against', () => {
    expect(loanPayoffProgress(loan({ openingPrincipal: 0 }), false)).toBeNull()
    expect(loanPayoffProgress(loan({ openingPrincipal: -5 }), false)).toBeNull()
  })

  it('clamps an overpaid loan at 100% instead of exceeding it', () => {
    const progress = loanPayoffProgress(loan({ outstandingBalance: -200 }), false)

    expect(progress?.percentPaid).toBe(100)
  })

  it('floors a grown balance at zero cleared rather than reporting negative progress', () => {
    // Interest capitalizing above the tracked opening balance must not read as owing less.
    const progress = loanPayoffProgress(loan({ outstandingBalance: 1800 }), false)

    expect(progress?.clearedPrincipal).toBe(0)
    expect(progress?.percentPaid).toBe(0)
  })

  it('reports a genuine 0% for an interest-only loan with its balance intact', () => {
    const progress = loanPayoffProgress(loan({ outstandingBalance: 1620 }), false)

    expect(progress).toEqual({ trackedPrincipal: 1620, clearedPrincipal: 0, percentPaid: 0 })
  })
})
