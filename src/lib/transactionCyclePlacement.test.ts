import { describe, expect, it } from 'vitest'
import { getTransactionCyclePlacement, isTransactionOutsideCycle } from './transactionCyclePlacement'

describe('transaction cycle placement', () => {
  it('uses the shared clamped cycle boundary rules', () => {
    expect(getTransactionCyclePlacement('2026-02-27', 28)).toEqual({
      month: 'Jan',
      year: 2026,
      label: 'Jan 28th ~ Feb 27th, 2026',
    })
    expect(getTransactionCyclePlacement('2026-02-28', 28)).toEqual({
      month: 'Feb',
      year: 2026,
      label: 'Feb 28th ~ Mar 27th, 2026',
    })
  })

  it('compares the transaction cycle with the selected cycle', () => {
    expect(isTransactionOutsideCycle('2026-08-20', 'Mar', 2026, 1)).toBe(true)
    expect(isTransactionOutsideCycle('2026-08-20', 'Aug', 2026, 1)).toBe(false)
  })
})
