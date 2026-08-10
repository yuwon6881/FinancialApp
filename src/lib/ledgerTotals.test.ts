import { describe, expect, it } from 'vitest'
import { calculateLedgerTotals } from './ledgerTotals'

describe('calculateLedgerTotals', () => {
  it('excludes transfers from debit/credit but tracks their volume separately', () => {
    expect(calculateLedgerTotals([
      { id: 'transfer-in', amount: 100, category: 'Transfer', ledgerCategory: 'Transfer:Essentials->Rewards' },
      { id: 'transfer-out', amount: -100, category: 'Transfer', ledgerCategory: 'Transfer:Essentials->Rewards' },
      { id: 'income', amount: 500, category: 'Salary', ledgerCategory: 'Income' },
      { id: 'expense', amount: -80, category: 'Food', ledgerCategory: 'Essentials' },
    ])).toEqual({ inflow: 500, outflow: 80, transfer: 200, bucket: null, bucketNet: 0 })
  })

  it('reports zero transfer volume when there are no transfers', () => {
    expect(calculateLedgerTotals([
      { id: 'income', amount: 500, category: 'Salary', ledgerCategory: 'Income' },
      { id: 'expense', amount: -80, category: 'Food', ledgerCategory: 'Essentials' },
    ])).toEqual({ inflow: 500, outflow: 80, transfer: 0, bucket: null, bucketNet: 0 })
  })

  // A single-bucket view is nearly all transfers, so debit and credit both sit at zero while the
  // bucket has plainly moved. This is the figure that reads negative when it has been drawn on.
  it('nets one bucket when the caller says which bucket is being filtered', () => {
    const drawdown = calculateLedgerTotals([
      { id: 'salary-split-Stability', amount: 600, category: 'Transfer', ledgerCategory: 'Transfer:Income->Stability' },
      { id: 'dip', amount: 900, category: 'Transfer', ledgerCategory: 'Transfer:Stability->Essentials' },
    ], 'Stability')

    expect(drawdown.inflow - drawdown.outflow).toBe(0)
    expect(drawdown.bucket).toBe('Stability')
    expect(drawdown.bucketNet).toBe(-300)
  })
})
