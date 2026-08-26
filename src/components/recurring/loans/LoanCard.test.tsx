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

describe('LoanCard headline', () => {
  it('leads with what is still owed and how much of the tracked principal is cleared', () => {
    render(<LoanCard {...props({ ...baseLoan, snapshot: { ...baseLoan.snapshot, outstandingBalance: 620 } })} />)

    expect(screen.getByText('Still owed')).toBeTruthy()
    expect(screen.getByText('RM 620.00')).toBeTruthy()

    const meter = screen.getByRole('progressbar', { name: '38% of the tracked principal cleared' })
    expect(meter.getAttribute('aria-valuenow')).toBe('38')
    expect(screen.getByText(/38% paid off/)).toBeTruthy()
    // "tracked", never "borrowed": the opening principal is the balance at the tracking start date.
    expect(screen.getByText(/RM 1000.00 tracked/)).toBeTruthy()
  })

  it('keeps one secondary fact visible and demotes the rest into Loan details', () => {
    render(<LoanCard {...props(baseLoan)} isMobile />)

    expect(screen.getByText('Next instalment')).toBeTruthy()
    // Still reachable, but inside the disclosure rather than competing for the summary.
    const payoff = screen.getByText('Expected payoff')
    expect(payoff.closest('details')).not.toBeNull()
    expect(screen.getByText('Remaining interest').closest('details')).not.toBeNull()
  })

  it('shows no balance, meter or percentage when the schedule is unavailable', () => {
    // The balance is not knowable, and a 0% bar would read as "no progress" rather than "unknown".
    render(<LoanCard {...props({ ...baseLoan, scheduleStatus: 'Incomplete' })} />)

    expect(screen.queryByText('Still owed')).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByText(/cannot show a balance or schedule/)).toBeTruthy()
  })

  it('shows no meter while a replay is in flight', () => {
    render(<LoanCard {...props({ ...baseLoan, isRecalculating: true })} />)

    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByText(/Recalculating from/)).toBeTruthy()
  })

  it('reports a genuine 0% for an untouched loan rather than hiding the bar', () => {
    render(<LoanCard {...props(baseLoan)} />)

    const meter = screen.getByRole('progressbar', { name: '0% of the tracked principal cleared' })
    expect(meter.getAttribute('aria-valuenow')).toBe('0')
  })

  it('names the final balance instead of an instalment amount when the loan is closing out', () => {
    render(<LoanCard {...props({
      ...baseLoan,
      interestMethod: 'InterestOnly',
      snapshot: { ...baseLoan.snapshot, scheduledPayment: 0 },
    })} />)

    expect(screen.getAllByText('Final balance due now').length).toBeGreaterThan(0)
  })
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

  it('names the repayment action as a payment', () => {
    render(<LoanCard {...props(baseLoan)} onRepay={vi.fn()} />)

    expect(screen.getByRole('button', { name: `Make a payment for ${baseLoan.name}` })).toBeTruthy()
    expect(screen.getByText('Make payment')).toBeTruthy()
  })

  it('starts the full-schedule loader in the disclosure event so preview rows never flash first', () => {
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
    const schedule = screen.getByRole('button', { name: /Payment history and planned schedule/ })
    fireEvent.click(schedule)

    expect(fetchLoanSchedule).toHaveBeenCalledWith('loan-card')
    expect(schedule.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('status').textContent).toContain('Loading full planned schedule')
    expect(screen.queryByText('Planned', { exact: true })).toBeNull()
  })
})
