import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CarryoverLedgerTable } from './CarryoverLedgerTable'
import type { CategorySummary } from '../../types'

const mockCategories: CategorySummary[] = [
  {
    name: 'Essentials',
    allocation: 0.5,
    target: 1896,
    incomeAllocated: 1896,
    budget: 7.93,
    spent: 1539.51,
    netChange: 364.42,
    remaining: 372.35,
    accounts: [
      { id: 'acc-1', name: 'Maybank', remaining: 200, isArchived: false },
      { id: 'acc-2', name: 'Cash Wallet', remaining: 172.35, isArchived: false },
    ],
  },
  {
    name: 'Growth',
    allocation: 0.25,
    target: 948,
    incomeAllocated: 948,
    budget: 2143.50,
    spent: 0,
    netChange: 800,
    remaining: 2943.50,
    accounts: [],
  },
]

const rewardsCategory: CategorySummary = {
  name: 'Rewards', allocation: 0.1, target: 100, incomeAllocated: 100,
  budget: 100, spent: 0, netChange: 100, remaining: 200, accounts: [],
}

describe('CarryoverLedgerTable', () => {
  it('shows current Rewards commitments and free money using the shared pool rules', () => {
    render(<CarryoverLedgerTable
      categories={[rewardsCategory]}
      isCurrentCycle
      cycleLabel="Sep 1st ~ Sep 30th"
      pendingDeductionsByCategory={{ Rewards: 30 }}
      savingsGoals={[{
        id: 1, name: 'Trip', targetAmount: 300, earmarkedAmount: 50,
        fundingBucket: 'Rewards', targetDate: '2026-12-01', priority: 'Medium',
        status: 'active', isRecurring: false, recurrenceMonths: 12,
        cycleFundedAmount: 0, createdAt: '2026-09-01T00:00:00Z',
      }]}
      amountsMasked={false}
      hideSensitive={false}
      formatCurrency={value => `RM ${value.toFixed(2)}`}
    />)

    expect(screen.getByText('Committed')).toBeTruthy()
    expect(screen.getByText('RM 80.00')).toBeTruthy()
    expect(screen.getByText('Free to spend')).toBeTruthy()
    expect(screen.getByText('RM 120.00')).toBeTruthy()
    expect(screen.queryByText('Projected')).toBeNull()
  })

  it('does not apply today’s Rewards commitments to a historical cycle', () => {
    render(<CarryoverLedgerTable
      categories={[rewardsCategory]}
      isCurrentCycle={false}
      cycleLabel="Jun 1st ~ Jun 30th"
      pendingDeductionsByCategory={{ Rewards: 30 }}
      amountsMasked={false}
      hideSensitive={false}
      formatCurrency={value => `RM ${value.toFixed(2)}`}
    />)
    expect(screen.queryByText('Committed')).toBeNull()
    expect(screen.queryByText('Free to spend')).toBeNull()
    expect(screen.getByText('Pending')).toBeTruthy()
    expect(screen.getByText('Projected')).toBeTruthy()
  })

  it('renders categories and opens the account breakdown modal on click', () => {
    const onNavigateToAccounts = vi.fn()
    render(
      <CarryoverLedgerTable
        categories={mockCategories}
        isCurrentCycle
        cycleLabel="Aug 1st ~ Aug 31st"
        pendingDeductionsByCategory={{}}
        amountsMasked={false}
        hideSensitive={false}
        formatCurrency={(val) => `RM ${val.toFixed(2)}`}
        onNavigateToAccounts={onNavigateToAccounts}
      />
    )

    expect(screen.getByText('Carryover Rolling Ledgers')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View account breakdown for Essentials' })).toBeTruthy()

    // No row edit/adjust button for Remaining Balance
    expect(screen.queryByTitle('Adjust balance')).toBeNull()

    // Click the 2 accounts badge
    fireEvent.click(screen.getByRole('button', { name: 'View account breakdown for Essentials' }))

    // The modal opens showing the breakdown
    expect(screen.getByText('Essentials Account Balances')).toBeTruthy()
    expect(screen.getByText('Maybank')).toBeTruthy()
    expect(screen.getByText('Cash Wallet')).toBeTruthy()
    expect(screen.getByText('Total accounts balance')).toBeTruthy()
    expect(screen.getByText('Current balance')).toBeTruthy()
    expect(screen.queryByText(/Account editing and corrections use today/)).toBeNull()

    // Clicking account Edit navigates to accounts section with account id
    const editButtons = screen.getAllByRole('button', { name: /Edit Maybank in Settings/i })
    fireEvent.click(editButtons[0])
    expect(onNavigateToAccounts).toHaveBeenCalledWith('acc-1')

    // Reopen modal and click footer button
    fireEvent.click(screen.getByRole('button', { name: 'View account breakdown for Essentials' }))
    fireEvent.click(screen.getByRole('button', { name: /Manage Essentials in Settings/i }))
    expect(onNavigateToAccounts).toHaveBeenCalledWith('Essentials')
  })

  it('labels past-cycle account figures as closing balances and explains where corrections post', () => {
    render(
      <CarryoverLedgerTable
        categories={mockCategories}
        isCurrentCycle={false}
        cycleLabel="Mar 1st ~ Mar 31st"
        pendingDeductionsByCategory={{}}
        amountsMasked={false}
        hideSensitive={false}
        formatCurrency={(val) => `RM ${val.toFixed(2)}`}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'View account breakdown for Essentials' }))

    expect(screen.getByText('Balance at close')).toBeTruthy()
    expect(screen.getByText('Total balance at close')).toBeTruthy()
    expect(screen.getByText(/Mar 1st ~ Mar 31st/)).toBeTruthy()
    expect(screen.getByText(/Account editing and corrections use today/)).toBeTruthy()
  })
})
