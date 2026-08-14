import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Loan, RecurringPayment } from '../../../../types'
import { useLoansView } from './useLoansView'

const payment = (id: string, ledgerCategory: RecurringPayment['ledgerCategory']): RecurringPayment => ({
  id,
  name: id,
  amount: -100,
  frequency: 'Monthly',
  category: 'Bills',
  ledgerCategory,
  accountId: 'acct-' + ledgerCategory.toLowerCase(),
  dueDate: 1,
  startDate: '2026-01-01',
  nextDueDate: '2026-09-01',
  active: true,
  paymentMode: 'Manual',
})

const loan = (id: string, balance: number, payoffDate: string | null, status: Loan['scheduleStatus'] = 'Complete'): Loan => ({
  id,
  name: id,
  recurringPaymentId: `bill-${id}`,
  openingPrincipal: balance,
  trackingStartDate: '2026-01-01',
  annualRatePercent: 5,
  termPeriods: 12,
  interestMethod: 'ReducingBalance',
  scheduleStatus: status,
  scheduleFrequency: 'Monthly',
  scheduleDueDay: 1,
  scheduleStartDate: '2026-01-01',
  recurringPaymentExists: true,
  snapshot: {
    outstandingBalance: balance,
    scheduledPayment: 100,
    totalScheduledInterest: 10,
    totalInterestPaid: 5,
    payoffDate,
    lastOccurrenceDate: null,
    nextPayment: null,
    payments: [],
    futureSchedule: [],
  },
})

describe('useLoansView', () => {
  it('filters by the linked bill ledger category', () => {
    const loans = [loan('Alpha', 500, '2027-01-01'), loan('Beta', 300, '2026-12-01')]
    const payments = [payment('bill-Alpha', 'Essentials'), payment('bill-Beta', 'Growth')]
    const { result } = renderHook(() => useLoansView(loans, payments, []))

    act(() => result.current.toggleCategory('Growth'))

    expect(result.current.filteredAndSortedLoans.map(value => value.id)).toEqual(['Beta'])
  })

  it('places incomplete forecasts after valid payoff dates with deterministic ties', () => {
    const loans = [
      loan('Zulu', 100, null, 'Incomplete'),
      loan('Beta', 100, '2027-02-01'),
      loan('Alpha', 100, '2027-02-01'),
    ]
    const { result } = renderHook(() => useLoansView(loans, [], []))

    act(() => result.current.setSortOrder('payoff-date'))

    expect(result.current.filteredAndSortedLoans.map(value => value.id)).toEqual(['Alpha', 'Beta', 'Zulu'])
  })
})
