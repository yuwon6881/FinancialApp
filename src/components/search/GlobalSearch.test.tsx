import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GlobalSearch, type GlobalSearchProps } from './GlobalSearch'
import type { LedgerAccount, Transaction } from '../../types'

const transaction: Transaction = {
  id: 'tx-1',
  date: '2026-08-04',
  description: 'Coffee beans',
  category: 'Food',
  ledgerCategory: 'Essentials',
  amount: -12.5,
}

const account = {
  id: 'acc-1',
  name: 'Coffee jar',
  bucket: 'Rewards',
  kind: 'Cash',
  isArchived: false,
  remaining: 80,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
} as LedgerAccount

const setup = (overrides: Partial<GlobalSearchProps> = {}) => {
  const props: GlobalSearchProps = {
    isOpen: true,
    onClose: vi.fn(),
    data: { transactions: [transaction], accounts: [account] },
    onOpenResult: vi.fn(),
    onSearchAllCycles: vi.fn(),
    formatAmount: value => `RM${Math.abs(value).toFixed(2)}`,
    maskAmounts: false,
    ...overrides,
  }
  render(<GlobalSearch {...props} />)
  return props
}

const type = (value: string) =>
  fireEvent.change(screen.getByRole('combobox', { name: 'Search your records' }), { target: { value } })

describe('GlobalSearch', () => {
  it('prompts instead of listing every record before a query is typed', () => {
    setup()
    expect(screen.getByText(/start typing to find a transaction/i)).toBeTruthy()
    expect(screen.queryByRole('option')).toBeNull()
  })

  it('groups matches under plain-language headings', () => {
    setup()
    type('coffee')
    expect(screen.getByText('Transactions in this cycle')).toBeTruthy()
    expect(screen.getByText('Accounts')).toBeTruthy()
    expect(screen.getByText('Coffee beans')).toBeTruthy()
    expect(screen.getByText('Coffee jar')).toBeTruthy()
  })

  it('opens the highlighted result on Enter and closes', () => {
    const props = setup()
    type('coffee beans')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })
    expect(props.onOpenResult).toHaveBeenCalledWith(
      expect.objectContaining({ target: { to: 'transaction', transactionId: 'tx-1' } }),
    )
    expect(props.onClose).toHaveBeenCalled()
  })

  it('moves the active option with the arrow keys and reports it to assistive tech', () => {
    setup()
    type('coffee')
    const input = screen.getByRole('combobox', { name: 'Search your records' })
    const first = input.getAttribute('aria-activedescendant')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).not.toBe(first)
  })

  it('always offers the all-cycles handoff, because only the loaded cycle was searched', () => {
    const props = setup()
    type('mortgage')
    expect(screen.getByText(/nothing in this cycle matches/i)).toBeTruthy()
    fireEvent.click(screen.getByText(/search every cycle for/i))
    expect(props.onSearchAllCycles).toHaveBeenCalledWith('mortgage')
  })

  it('closes on Escape', () => {
    const props = setup()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalled()
  })

  it('renders amounts through the caller formatter', () => {
    setup()
    type('coffee beans')
    expect(screen.getByText('RM12.50')).toBeTruthy()
  })

  it('stops matching amounts while they are masked, so a query cannot probe a figure', () => {
    setup({ maskAmounts: true, formatAmount: () => '......' })
    type('12.50')
    expect(screen.queryByText('Coffee beans')).toBeNull()
    // The description still matches, and the amount shows only as the mask.
    type('coffee beans')
    expect(screen.getByText('Coffee beans')).toBeTruthy()
    expect(screen.getByText('......')).toBeTruthy()
  })

  it('renders nothing at all when closed', () => {
    setup({ isOpen: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
