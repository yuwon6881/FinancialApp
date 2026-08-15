import { describe, expect, it } from 'vitest'
import { countLoanPaymentsThrough, loanEndDate } from '../../lib/loanTermSchedule'
import type { Loan } from '../../types'
import { readFixture } from './runParity'

interface EndDateCase {
  id: string
  why: string
  input: {
    kind: 'endDate'
    loan: Loan
  }
  expected: {
    endDate: string | null
  }
}

interface CountThroughCase {
  id: string
  why: string
  input: {
    kind: 'countThrough'
    loan: Loan
    endDate: string
  }
  expected: {
    count: number | null
  }
}

type LoanTermScheduleCase = EndDateCase | CountThroughCase

describe('loan term schedule parity', () => {
  const cases = readFixture<LoanTermScheduleCase>('loan-term-schedule')

  for (const item of cases) {
    it(`[${item.id}] ${item.why}`, () => {
      if (item.input.kind === 'endDate') {
        const actual = loanEndDate(item.input.loan)
        const expected = item.expected as EndDateCase['expected']
        expect(actual).toBe(expected.endDate)
      } else if (item.input.kind === 'countThrough') {
        const actual = countLoanPaymentsThrough(item.input.loan, item.input.endDate)
        const expected = item.expected as CountThroughCase['expected']
        expect(actual).toBe(expected.count)
      }
    })
  }
})
