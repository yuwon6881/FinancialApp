import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AccountBillRoster as AccountBillRosterType } from '../../../lib/accountBillRoster'
import { AccountBillRoster } from './AccountBillRoster'

const mockRoster: AccountBillRosterType = {
  accountId: 'acc-1',
  active: [
    {
      payment: {
        id: 'bill-1',
        name: 'Fiber Internet',
        amount: 150,
        frequency: 'Monthly',
        category: 'Utilities',
        ledgerCategory: 'Essentials',
        accountId: 'acc-1',
        nextDueDate: '2026-08-28',
        dueDate: 28,
        startDate: '2026-01-01',
        active: true,
        paymentMode: 'AutoDeduct',
      },
      monthlyEquivalent: 150,
      nextDueDate: '2026-08-28',
    },
    {
      payment: {
        id: 'bill-2',
        name: 'Car Loan Installment',
        amount: 800,
        frequency: 'Monthly',
        category: 'Transport',
        ledgerCategory: 'Essentials',
        accountId: 'acc-1',
        nextDueDate: '2026-09-05',
        dueDate: 5,
        startDate: '2026-01-01',
        active: true,
        paymentMode: 'AutoDeduct',
        linkedLoanName: 'Honda Civic',
      },
      monthlyEquivalent: 800,
      nextDueDate: '2026-09-05',
    },
  ],
  paused: [
    {
      payment: {
        id: 'bill-3',
        name: 'Old Gym Membership',
        amount: 120,
        frequency: 'Monthly',
        category: 'Fitness',
        ledgerCategory: 'Rewards',
        accountId: 'acc-1',
        nextDueDate: null,
        dueDate: 1,
        startDate: '2025-01-01',
        active: false,
        paymentMode: 'Manual',
      },
      monthlyEquivalent: 120,
      nextDueDate: null,
    },
  ],
  monthlyTotal: 950,
  autoDeductCount: 2,
}

describe('AccountBillRoster', () => {
  it('renders closed summary with total count and estimated monthly total', () => {
    render(
      <AccountBillRoster
        roster={mockRoster}
        currency="USD"
        hideSensitive={false}
      />,
    )

    expect(screen.getByText(/Bills paid from here · 3/)).toBeDefined()
    expect(screen.getByText('about')).toBeDefined()
    expect(screen.getByText('$950.00')).toBeDefined()
    expect(screen.getByText('/ mo')).toBeDefined()
  })

  it('renders bill details when expanded and calls onNavigateToRecurring on click', () => {
    const onNavigate = vi.fn()
    render(
      <AccountBillRoster
        roster={mockRoster}
        currency="USD"
        hideSensitive={false}
        onNavigateToRecurring={onNavigate}
      />,
    )

    expect(screen.getByText('Fiber Internet')).toBeDefined()
    expect(screen.getByText('Next 28 Aug')).toBeDefined()
    expect(screen.getAllByText('Auto deduct')).toHaveLength(2)
    expect(screen.getByText('Honda Civic')).toBeDefined()

    const viewButtons = screen.getAllByRole('button', { name: /View .* in recurring bills/ })
    expect(viewButtons).toHaveLength(3)

    fireEvent.click(viewButtons[0])
    expect(onNavigate).toHaveBeenCalledWith('bill-1')
  })

  it('masks amounts when hideSensitive is true', () => {
    render(
      <AccountBillRoster
        roster={mockRoster}
        currency="USD"
        hideSensitive={true}
      />,
    )

    expect(screen.queryByText('$950.00')).toBeNull()
    expect(screen.queryByText('$150.00')).toBeNull()
  })

  it('renders empty dashed container when roster has no active or paused bills', () => {
    const emptyRoster: AccountBillRosterType = {
      accountId: 'acc-empty',
      active: [],
      paused: [],
      monthlyTotal: 0,
      autoDeductCount: 0,
    }

    render(
      <AccountBillRoster
        roster={emptyRoster}
        currency="USD"
        hideSensitive={false}
      />,
    )

    expect(screen.getByText(/Bills paid from here · 0/)).toBeDefined()
    expect(screen.getByText('No recurring bills paid from this account.')).toBeDefined()
  })
})
