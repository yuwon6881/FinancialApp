import { describe, expect, it } from 'vitest'
import { replayLoan, type LoanPaymentInput } from '../../lib/loanMath'
import type { Loan } from '../../types'
import { readFixture } from './runParity'

interface LoanReplayCase {
  id: string
  why: string
  input: {
    loan: Loan
    inputs: LoanPaymentInput[]
  }
  expected: {
    outstandingBalance: number
    scheduledPayment: number
    totalScheduledInterest: number
    totalInterestPaid: number
    payoffDate: string | null
    lastOccurrenceDate: string | null
    paymentCount: number
    futureScheduleCount: number
    // Optional: only cases that turn on where the schedule *starts* need to pin it, and every other
    // assertion here is blind to a schedule shifted wholesale by a whole number of months.
    firstFutureOccurrenceDate?: string
  }
}

describe('loan replay parity', () => {
  const cases = readFixture<LoanReplayCase>('loan-replay')

  for (const { id, why, input, expected } of cases) {
    it(`[${id}] ${why}`, () => {
      const result = replayLoan(input.loan, input.loan.scheduleFrequency, input.inputs)

      expect(result.outstandingBalance).toBeCloseTo(expected.outstandingBalance, 2)
      expect(result.scheduledPayment).toBeCloseTo(expected.scheduledPayment, 2)
      expect(result.totalScheduledInterest).toBeCloseTo(expected.totalScheduledInterest, 2)
      expect(result.totalInterestPaid).toBeCloseTo(expected.totalInterestPaid, 2)
      expect(result.payoffDate ?? null).toBe(expected.payoffDate)
      expect(result.lastOccurrenceDate ?? null).toBe(expected.lastOccurrenceDate)
      expect(result.payments.length).toBe(expected.paymentCount)
      expect(result.futureSchedule.length).toBe(expected.futureScheduleCount)
      if (expected.firstFutureOccurrenceDate !== undefined) {
        expect(result.futureSchedule[0].occurrenceDate).toBe(expected.firstFutureOccurrenceDate)
      }
    })
  }
})
