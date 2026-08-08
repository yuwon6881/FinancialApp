import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { LedgerTransactionList } from './LedgerTransactionList'
import type { Transaction } from '../../types'

// The ledger used to render the desktop table and the mobile card list at the same
// time and CSS-hide one. These tests pin the replacement contract: exactly one
// layout is mounted, chosen to match Tailwind's `md:` breakpoint.

const tx: Transaction = {
  id: 'tx-1',
  date: '2026-07-01',
  description: 'Coffee beans',
  category: 'Food',
  ledgerCategory: 'Food',
  amount: -12.5,
} as Transaction

type ListProps = ComponentProps<typeof LedgerTransactionList>

const baseListProps: ListProps = {
  transactions: [tx],
  listKey: 'k',
  hideSensitive: false,
  currency: 'MYR',
  serverIsFetching: false,
  pageTotals: { inflow: 0, outflow: 12.5, transfer: 0 },
  isTxDeleting: () => false,
  isTxSyncing: () => false,
  onStartEdit: () => {},
  onDeleteClick: () => {},
  onEditBlocked: () => {},
  formatSensitive: (v) => <span>{v.toFixed(2)}</span>,
}

function renderList(overrides: Partial<ListProps> = {}) {
  return render(
    <LedgerTransactionList {...baseListProps} {...overrides} />,
  )
}

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
}

const originalWidth = window.innerWidth

afterEach(() => {
  cleanup()
  setViewport(originalWidth)
})

describe('LedgerTransactionList layout selection', () => {
  it('renders only the desktop table at >= 768px', () => {
    setViewport(1024)
    renderList()

    expect(document.querySelector('table')).not.toBeNull()
    expect(document.getElementById('tx-row-desktop-tx-1')).not.toBeNull()
    // The mobile card for the same transaction must not exist at all.
    expect(document.getElementById('tx-row-mobile-tx-1')).toBeNull()
    expect(screen.queryByText('Page Total Summary')).toBeNull()
  })

  it('renders only the mobile card list below 768px', () => {
    setViewport(390)
    renderList()

    expect(document.querySelector('table')).toBeNull()
    expect(document.getElementById('tx-row-mobile-tx-1')).not.toBeNull()
    expect(document.getElementById('tx-row-desktop-tx-1')).toBeNull()
    expect(screen.getByText('Page Total Summary')).not.toBeNull()
  })

  it('treats a fractional width just under the breakpoint as mobile, like Tailwind does', () => {
    // `(max-width: 767px)` is false at 767.5 while Tailwind's `md:` is also false,
    // so the old query form disagreed with the CSS here.
    setViewport(767.5)
    renderList()

    expect(document.getElementById('tx-row-mobile-tx-1')).not.toBeNull()
    expect(document.querySelector('table')).toBeNull()
  })

  it('keeps the entrance container mounted while selection mode changes', () => {
    setViewport(1024)
    const { rerender } = renderList()
    const body = document.querySelector('tbody')

    rerender(
      <LedgerTransactionList
        {...baseListProps}
        isSelecting
        canSelect={() => true}
        isSelected={() => false}
        onToggleSelected={() => undefined}
      />,
    )

    expect(document.querySelector('tbody')).toBe(body)
  })
})
