import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Loan } from '../../../types'
import { LoanCard } from './LoanCard'

const { fetchLoanSchedule } = vi.hoisted(() => ({ fetchLoanSchedule: vi.fn() }))
vi.mock('../../../lib/api/loans', () => ({ fetchLoanSchedule }))

const baseLoan: Loan = {
  id: 'loan-card',
  name: 'Card loan',
  recurringPaymentId: 'bill-card',
  openingPrincipal: 1000,
  trackingStartDate: '2026-01-01',
  annualRatePercent: 17.04,
  rateBasis: 'Monthly',
  termPeriods: 3,
  interestMethod: 'ReducingBalance',
  scheduleFrequency: 'Monthly',
  scheduleDueDay: 1,
  scheduleStartDate: '2026-01-01',
  scheduleStatus: 'Complete',
  recurringPaymentExists: true,
  recurringPaymentName: 'Card bill',
  snapshot: {
    outstandingBalance: 1000,
    scheduledPayment: 340,
    totalScheduledInterest: 20,
    totalInterestPaid: 0,
    payoffDate: null,
    lastOccurrenceDate: null,
    nextPayment: null,
    payments: [],
    futureSchedule: [],
  },
}

const props = (loan: Loan) => ({
  loan,
  currency: 'MYR',
  hideSensitive: false,
  formatSensitive: (value: number) => `RM ${value.toFixed(2)}`,
  isSyncing: false,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onExplain: vi.fn(),
})

describe('LoanCard', () => {
  it('uses plain-language labels for every interest method', () => {
    for (const method of ['ReducingBalance', 'ReducingBalanceDaily', 'Flat', 'InterestOnly'] as const) {
      const { unmount } = render(<LoanCard {...props({ ...baseLoan, interestMethod: method })} />)

      expect(screen.queryByText(method, { exact: true })).toBeNull()
      unmount()
    }
  })

  it('shows both rate units and the honest interest-only balloon state', () => {
    render(<LoanCard {...props({
      ...baseLoan,
      interestMethod: 'InterestOnly',
      snapshot: { ...baseLoan.snapshot, nextPayment: null, outstandingBalance: 1000, payoffDate: null },
    })} />)

    expect(screen.getByText('1.42% a month (17.04% a year)')).not.toBeNull()
    expect(screen.getByText('No automatic payoff')).not.toBeNull()
    expect(screen.getAllByText('Final balance due now').length).toBeGreaterThan(0)
  })

  it('keeps secondary loan details collapsed on mobile while preserving the desktop summary', () => {
    const mobile = render(<LoanCard {...props(baseLoan)} isMobile />)
    expect(screen.getByText('Loan details').closest('details')?.open).toBe(false)
    mobile.unmount()

    render(<LoanCard {...props(baseLoan)} isMobile={false} />)
    expect(screen.getByText('Loan details').closest('details')?.open).toBe(true)
  })

  it('renders Ask AI, Edit, and Delete action buttons', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const onExplain = vi.fn()
    render(<LoanCard {...props(baseLoan)} onEdit={onEdit} onDelete={onDelete} onExplain={onExplain} />)

    expect(screen.getByText('Explain this loan')).not.toBeNull()
    expect(screen.getByText('Edit')).not.toBeNull()
    expect(screen.getByText('Delete')).not.toBeNull()
  })

  it('shows the standard loader instead of stale schedule rows while the full schedule loads', () => {
    fetchLoanSchedule.mockReturnValue(new Promise(() => {}))
    const scheduledLoan = {
      ...baseLoan,
      snapshot: {
        ...baseLoan.snapshot,
        futureSchedule: [{
          occurrenceDate: '2026-02-01', payment: 340, interest: 10,
          principal: 330, balanceAfter: 670,
        }],
      },
    }
    render(<LoanCard {...props(scheduledLoan)} />)
    const schedule = screen.getByText('Payment history and planned schedule').closest('details')!
    schedule.open = true
    fireEvent(schedule, new Event('toggle', { bubbles: true }))

    expect(screen.getByRole('status').textContent).toContain('Loading full planned schedule')
    expect(screen.queryByText('Planned', { exact: true })).toBeNull()
  })
})
