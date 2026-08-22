import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
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
  fireEvent.change(screen.getByRole('combobox', { name: 'Search query' }), { target: { value } })

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
      expect.objectContaining({ target: { to: 'transaction', transactionId: 'tx-1', transactionDate: '2026-08-04' } }),
    )
    expect(props.onClose).toHaveBeenCalled()
  })

  it('moves the active option with the arrow keys and reports it to assistive tech', () => {
    setup()
    type('coffee')
    const input = screen.getByRole('combobox', { name: 'Search query' })
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

  it('keeps a masked amount neutral, so the colour cannot disclose the sign the mask withholds', () => {
    setup({ maskAmounts: true, formatAmount: () => '......' })
    type('coffee')
    const masked = screen.getAllByText('......')[0]
    expect(masked.className).not.toContain('text-orange-500')

    cleanup()
    setup({ maskAmounts: false })
    type('coffee')
    expect(screen.getByText('RM12.50').className).toContain('text-orange-500')
  })

  it('says how many matches the per-kind cap is not showing', () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      ...transaction,
      id: `tx-${index}`,
      description: `Coffee ${index}`,
    }))
    setup({ data: { transactions: many } })
    type('coffee')
    expect(screen.getByText(/\+4 more/)).toBeTruthy()
    expect(screen.getByText('10 found in this cycle')).toBeTruthy()
    // Informational, not an option: arrowing onto it would give Enter nothing to open.
    expect(screen.getAllByRole('option')).toHaveLength(7)
  })

  it('says loans could not be loaded rather than letting it read as "no loans matched"', () => {
    const onRetryLoans = vi.fn()
    setup({ didLoansFailToLoad: true, onRetryLoans })
    type('coffee')
    expect(screen.getByText(/loans could not be loaded/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetryLoans).toHaveBeenCalled()
  })

  it('labels a record that is still waiting to be saved', () => {
    setup({ data: { accounts: [{ ...account, isPendingSync: true }] } })
    type('coffee')
    expect(screen.getByTitle('Pending sync (offline)')).toBeTruthy()
  })

  it('returns focus to whatever opened it', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    const props = setup()
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Search' }), { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('closes on Escape even before focus has reached the panel', () => {
    const props = setup()
    // Focus lands a frame after mount, so a panel-scoped handler would miss this entirely.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalled()
  })

  it('keeps Tab inside the panel instead of leaking focus to the page behind it', () => {
    setup()
    const input = screen.getByRole('combobox', { name: 'Search query' })
    const event = createEvent.keyDown(screen.getByRole('dialog', { name: 'Search' }), { key: 'Tab' })
    fireEvent(screen.getByRole('dialog', { name: 'Search' }), event)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(input)
  })

  it('jumps to the first and last row with Home and End', () => {
    setup()
    type('coffee')
    const dialog = screen.getByRole('dialog', { name: 'Search' })
    const input = screen.getByRole('combobox', { name: 'Search query' })
    fireEvent.keyDown(dialog, { key: 'End' })
    const last = input.getAttribute('aria-activedescendant')
    fireEvent.keyDown(dialog, { key: 'Home' })
    expect(input.getAttribute('aria-activedescendant')).toBe('global-search-option-0')
    expect(last).not.toBe('global-search-option-0')
  })

  it('does not close when a drag that started inside the panel releases on the backdrop', () => {
    const props = setup()
    const dialog = screen.getByRole('dialog', { name: 'Search' })
    const backdrop = dialog.parentElement!
    fireEvent.mouseDown(dialog)
    fireEvent.click(backdrop)
    expect(props.onClose).not.toHaveBeenCalled()

    fireEvent.mouseDown(backdrop)
    fireEvent.click(backdrop)
    expect(props.onClose).toHaveBeenCalled()
  })

  it('keeps the active row addressable when a longer query shrinks the list', () => {
    setup()
    type('coffee')
    const dialog = screen.getByRole('dialog', { name: 'Search' })
    const input = screen.getByRole('combobox', { name: 'Search query' })
    fireEvent.keyDown(dialog, { key: 'End' })
    type('coffee beans')
    const active = input.getAttribute('aria-activedescendant')!
    const options = screen.getAllByRole('option').map(option => option.id)
    expect(options).toContain(active)
  })
})
