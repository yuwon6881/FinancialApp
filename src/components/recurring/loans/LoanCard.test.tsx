import { fireEvent, render, screen, within } from '@testing-library/react'
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
    // "tracked", never "borrowed": the opening principal is the balance at the tracking start date.
    expect(screen.getByText(/RM 1000.00 tracked/)).toBeTruthy()
  })

  it('keeps one secondary fact beside the hero and the rest in the Details section', () => {
    render(<LoanCard {...props(baseLoan)} />)

    expect(screen.getByText('Next instalment')).toBeTruthy()
    // Still reachable, but in the sections below rather than competing for the summary.
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('Expected payoff')).toBeTruthy()
    expect(within(panel).getByText('Remaining interest')).toBeTruthy()
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
    expect(screen.getAllByText('No automatic payoff').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Final balance due now').length).toBeGreaterThan(0)
  })

  it('switches between details, the planned schedule and the payment history', () => {
    fetchLoanSchedule.mockResolvedValue([])
    render(<LoanCard {...props(baseLoan)} />)

    expect(screen.getByRole('tab', { name: 'Details' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: /History/ }))
    expect(screen.getByRole('tab', { name: /History/ }).getAttribute('aria-selected')).toBe('true')
    expect(within(screen.getByRole('tabpanel')).getByText('No payments recorded yet.')).toBeTruthy()
    expect(screen.queryByText('Expected payoff')).toBeNull()
  })

  it('renders Ask AI, Edit, and Delete action buttons', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const onExplain = vi.fn()
    render(<LoanCard {...props(baseLoan)} onEdit={onEdit} onDelete={onDelete} onExplain={onExplain} />)

    expect(screen.getByText('Explain this loan')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: `Edit ${baseLoan.name}` }))
    fireEvent.click(screen.getByRole('button', { name: `Delete ${baseLoan.name}` }))
    expect(onEdit).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalled()
  })

  it('names the repayment action as a payment', () => {
    render(<LoanCard {...props(baseLoan)} onRepay={vi.fn()} />)

    expect(screen.getByRole('button', { name: `Make a payment for ${baseLoan.name}` })).toBeTruthy()
    expect(screen.getByText('Make payment')).toBeTruthy()
  })

  it('starts the full-schedule loader in the tab event so preview rows never flash first', () => {
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
    const schedule = screen.getByRole('tab', { name: 'Schedule' })
    fireEvent.click(schedule)

    expect(fetchLoanSchedule).toHaveBeenCalledWith('loan-card')
    expect(schedule.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('status').textContent).toContain('Loading full planned schedule')
    expect(screen.queryByText('Planned', { exact: true })).toBeNull()
  })
})
