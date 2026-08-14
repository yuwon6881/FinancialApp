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

describe('CarryoverLedgerTable', () => {
  it('renders categories and opens the account breakdown modal on click', () => {
    render(
      <CarryoverLedgerTable
        categories={mockCategories}
        pendingDeductionsByCategory={{}}
        amountsMasked={false}
        hideSensitive={false}
        formatCurrency={(val) => `RM ${val.toFixed(2)}`}
        onAdjust={vi.fn()}
      />
    )

    expect(screen.getByText('Carryover Rolling Ledgers')).toBeTruthy()
    expect(screen.getByText('2 accounts')).toBeTruthy()

    // Click the 2 accounts badge
    fireEvent.click(screen.getByText('2 accounts'))

    // The modal opens showing the breakdown
    expect(screen.getByText('Essentials Account Balances')).toBeTruthy()
    expect(screen.getByText('Maybank')).toBeTruthy()
    expect(screen.getByText('Cash Wallet')).toBeTruthy()
    expect(screen.getByText('Total accounts balance')).toBeTruthy()
  })
})
