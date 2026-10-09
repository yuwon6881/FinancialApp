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
  pageTotals: { inflow: 0, outflow: 12.5, transfer: 0, bucket: null, bucketNet: 0 },
  isTxDeleting: () => false,
  isTxSyncing: () => false,
  onStartEdit: () => {},
  onDeleteClick: () => {},
  onEditBlocked: () => {},
  hasAnyFilter: false,
  onResetFilters: () => {},
  onAddTransaction: () => {},
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
  it('renders only the desktop table at dense widths (>= 1280px)', () => {
    setViewport(1280)
    renderList()

    expect(document.querySelector('table')).not.toBeNull()
    expect(document.getElementById('tx-row-desktop-tx-1')).not.toBeNull()
    // The mobile card for the same transaction must not exist at all.
    expect(document.getElementById('tx-row-mobile-tx-1')).toBeNull()
    // Both layouts close on the same totals strip.
    expect(screen.getByRole('region', { name: 'Page totals' })).not.toBeNull()
  })

  it('renders only the mobile card list below 1280px', () => {
    setViewport(1024)
    renderList()

    expect(document.querySelector('table')).toBeNull()
    expect(document.getElementById('tx-row-mobile-tx-1')).not.toBeNull()
    expect(document.getElementById('tx-row-desktop-tx-1')).toBeNull()
    expect(screen.getByRole('region', { name: 'Page totals' })).not.toBeNull()
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
    setViewport(1280)
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

  it('removes duplicate bucket movement when it matches the net', () => {
    setViewport(1024)
    renderList({
      pageTotals: { inflow: 0, outflow: 12.5, transfer: 0, bucket: 'Essentials', bucketNet: -12.5 },
    })

    expect(screen.queryByText('Essentials movement')).toBeNull()
    expect(screen.getByText('Net')).not.toBeNull()
  })

  it('shows bucket movement when it differs from the net', () => {
    setViewport(1024)
    renderList({
      pageTotals: { inflow: 100, outflow: 0, transfer: 0, bucket: 'Essentials', bucketNet: 25 },
    })

    expect(screen.getByText('Essentials movement')).not.toBeNull()
    expect(screen.queryByText('Net')).toBeNull()
  })

  it('groups rows under their day while sorted by date, and lists them flat otherwise', () => {
    setViewport(390)
    const second = { ...tx, id: 'tx-2', date: '2026-06-30', description: 'Bus fare' }
    const { unmount } = renderList({ transactions: [tx, second], groupByDay: true })
    expect(screen.getAllByRole('region').map(region => region.getAttribute('aria-label')))
      .toEqual(['Wed, Jul 1', 'Tue, Jun 30', 'Page totals'])
    unmount()

    renderList({ transactions: [tx, second], groupByDay: false })
    expect(screen.queryByRole('region', { name: 'Wed, Jul 1' })).toBeNull()
  })

  it('keeps the net for an unfiltered page on mobile', () => {
    setViewport(390)
    renderList()

    expect(screen.getByText('Net')).not.toBeNull()
  })
})
