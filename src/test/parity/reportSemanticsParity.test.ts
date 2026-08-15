import { describe, expect, it } from 'vitest'
import {
  isBalanceAdjustment,
  isReportableCashMovement,
  isReportableIncome,
  isReportableInflow,
  isReportableOutflow,
  isReportTransfer,
} from '../../lib/transactionReportSemantics'
import { readFixture } from './runParity'

interface ReportSemanticsCase {
  id: string
  why: string
  input: {
    amount: number
    category: string
    ledgerCategory: string
  }
  expected: {
    isTransfer: boolean
    isBalanceAdjustment: boolean
    isReportableCashMovement: boolean
    isReportableInflow: boolean
    isReportableOutflow: boolean
    isReportableIncome: boolean
  }
}

describe('report semantics parity', () => {
  const cases = readFixture<ReportSemanticsCase>('report-semantics')

  for (const { id, why, input, expected } of cases) {
    it(`[${id}] ${why}`, () => {
      expect(isReportTransfer(input)).toBe(expected.isTransfer)
      expect(isBalanceAdjustment(input)).toBe(expected.isBalanceAdjustment)
      expect(isReportableCashMovement(input)).toBe(expected.isReportableCashMovement)
      expect(isReportableInflow(input)).toBe(expected.isReportableInflow)
      expect(isReportableOutflow(input)).toBe(expected.isReportableOutflow)
      expect(isReportableIncome(input)).toBe(expected.isReportableIncome)
    })
  }
})
