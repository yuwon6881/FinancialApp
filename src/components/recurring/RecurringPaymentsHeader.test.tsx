import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RecurringPaymentsHeader } from './RecurringPaymentsHeader'

const baseProps = {
  totalCommittedMonthly: 420,
  totalCommittedAnnual: 5040,
  activeCount: 2,
  totalCount: 3,
  showAddForm: false,
  hideSensitive: false,
  formatSensitive: (value: number) => `$${value}`,
  onToggleForm: vi.fn(),
  onAddLoan: vi.fn(),
}

describe('RecurringPaymentsHeader', () => {
  it('shows loan totals, yearly total, and removes the subscription action on the Loans tab', () => {
    render(
      <RecurringPaymentsHeader
        {...baseProps}
        activeView="loans"
        loanTotalOutstanding={1250}
        loanTotalAnnual={3000}
        loanCount={2}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Loans' })).not.toBeNull()
    expect(screen.getByText('Total still owed')).not.toBeNull()
    expect(screen.getByText('$1250')).not.toBeNull()
    expect(screen.getByText('Yearly Total')).not.toBeNull()
    expect(screen.getByText('$3000')).not.toBeNull()
    expect(screen.getByText('Loans tracked')).not.toBeNull()
    expect(screen.getByText('2')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /new subscription/i })).toBeNull()
    expect(screen.queryByText('Next payment')).toBeNull()
    expect(screen.getByRole('button', { name: /new loan/i })).not.toBeNull()
  })

  it('says loan total and yearly total are unavailable rather than guessing', () => {
    render(<RecurringPaymentsHeader {...baseProps} activeView="loans" loanTotalOutstanding={null} loanTotalAnnual={null} loanCount={1} />)

    expect(screen.queryByText('Next payment')).toBeNull()
    expect(screen.getByText('Total still owed')).not.toBeNull()
    expect(screen.getByText('Yearly Total')).not.toBeNull()
    expect(screen.getAllByText('Unavailable').length).toBe(2)
  })

  it('keeps the recurring summary and add action on the recurring tab', () => {
    render(<RecurringPaymentsHeader {...baseProps} activeView="recurring" />)

    expect(screen.getByRole('heading', { name: 'Recurring Bills & Subscriptions' })).not.toBeNull()
    expect(screen.getByText('Monthly Total')).not.toBeNull()
    expect(screen.getByText('Yearly Total')).not.toBeNull()
    expect(screen.getByText('$5040')).not.toBeNull()
    expect(screen.getByRole('button', { name: /new subscription/i })).not.toBeNull()
    expect(screen.queryByRole('button', { name: /new loan/i })).toBeNull()
  })
})
