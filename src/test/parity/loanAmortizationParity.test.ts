import { describe, expect, it } from 'vitest'
import { applyPayment, scheduledPayment, totalScheduledInterest } from '../../lib/loanMath'
import type { Loan } from '../../types'
import { readFixture } from './runParity'

interface LoanAmortizationCase {
  id: string
  why: string
  input: {
    loan: Pick<Loan, 'openingPrincipal' | 'annualRatePercent' | 'termPeriods' | 'interestMethod'>
    frequency: string
    occurrenceDate: string
    balanceBefore: number
    payment: number
    paymentNumber: number
    flatInterestPaidBefore: number
    previousAccrualDate: string
  }
  expected: {
    scheduledPayment: number
    totalScheduledInterest: number
    split: {
      payment: number
      interest: number
      principal: number
      balanceBefore: number
      balanceAfter: number
      surplus: number
      paymentDidNotCoverInterest: boolean
    }
  }
}

describe('loan amortization parity', () => {
  const cases = readFixture<LoanAmortizationCase>('loan-amortization')

  for (const { id, why, input, expected } of cases) {
    it(`[${id}] ${why}`, () => {
      const pmt = scheduledPayment(input.loan, input.frequency)
      expect(pmt).toBeCloseTo(expected.scheduledPayment, 2)

      const totInt = totalScheduledInterest(input.loan, input.frequency)
      expect(totInt).toBeCloseTo(expected.totalScheduledInterest, 2)

      const split = applyPayment(
        input.loan,
        input.frequency,
        input.occurrenceDate,
        input.balanceBefore,
        input.payment,
        input.paymentNumber,
        input.flatInterestPaidBefore,
        input.previousAccrualDate,
      )

      expect(split.payment).toBeCloseTo(expected.split.payment, 2)
      expect(split.interest).toBeCloseTo(expected.split.interest, 2)
      expect(split.principal).toBeCloseTo(expected.split.principal, 2)
      expect(split.balanceBefore).toBeCloseTo(expected.split.balanceBefore, 2)
      expect(split.balanceAfter).toBeCloseTo(expected.split.balanceAfter, 2)
      expect(split.surplus).toBeCloseTo(expected.split.surplus, 2)
      expect(split.paymentDidNotCoverInterest).toBe(expected.split.paymentDidNotCoverInterest)
    })
  }
})
