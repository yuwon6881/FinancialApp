import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types'
import { buildReportBreakdown } from './reportCalculations'
import {
  isReportableCashMovement,
  isReportableInflow,
  isReportableOutflow,
} from './transactionReportSemantics'

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  date: '2026-08-10',
  description: 'Internal move',
  category: 'Food',
  ledgerCategory: 'AccountMove',
  amount: 500,
  ...overrides,
})

describe('transactionReportSemantics', () => {
  it('excludes AccountMove rows from cash-flow classifications and breakdowns', () => {
    const move = transaction()

    expect(isReportableCashMovement(move)).toBe(false)
    expect(isReportableInflow(move)).toBe(false)
    expect(isReportableOutflow({ ...move, amount: -500 })).toBe(false)
    expect(buildReportBreakdown([{ ...move, amount: -500 }])).toEqual([])
  })

})
