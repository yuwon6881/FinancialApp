import { describe, expect, it } from 'vitest'
import { calculateLedgerTotals } from './ledgerTotals'

describe('calculateLedgerTotals', () => {
  it('excludes transfers from debit/credit but tracks their volume separately', () => {
    expect(calculateLedgerTotals([
      { id: 'transfer-in', amount: 100, category: 'Transfer', ledgerCategory: 'Transfer:Essentials->Rewards' },
      { id: 'transfer-out', amount: -100, category: 'Transfer', ledgerCategory: 'Transfer:Essentials->Rewards' },
      { id: 'income', amount: 500, category: 'Salary', ledgerCategory: 'Income' },
      { id: 'expense', amount: -80, category: 'Food', ledgerCategory: 'Essentials' },
    ])).toEqual({ inflow: 500, outflow: 80, transfer: 200 })
  })

  it('reports zero transfer volume when there are no transfers', () => {
    expect(calculateLedgerTotals([
      { id: 'income', amount: 500, category: 'Salary', ledgerCategory: 'Income' },
      { id: 'expense', amount: -80, category: 'Food', ledgerCategory: 'Essentials' },
    ])).toEqual({ inflow: 500, outflow: 80, transfer: 0 })
  })
})
