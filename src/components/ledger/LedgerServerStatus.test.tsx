import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { LedgerServerStatus } from './LedgerServerStatus'
import type { LedgerListProps } from './ledgerListShared'
import type { Transaction } from '../../types'

const transaction = (id: string, amount: number): Transaction => ({
  id,
  date: '2026-07-01',
  description: id,
  category: 'Food',
  ledgerCategory: 'Essentials',
  amount,
} as Transaction)

// The server page holds far more money than the one row still syncing.
const listProps: LedgerListProps = {
  transactions: [transaction('saved-1', -500), transaction('saved-2', -400)],
  listKey: 'k',
  hideSensitive: false,
  currency: 'MYR',
  serverIsFetching: false,
  pageTotals: { inflow: 0, outflow: 900, transfer: 0, bucket: null, bucketNet: 0 },
  isTxDeleting: () => false,
  isTxSyncing: () => false,
  onStartEdit: () => {},
  onDeleteClick: () => {},
  onEditBlocked: () => {},
  hasAnyFilter: false,
  onResetFilters: () => {},
  onAddTransaction: () => {},
  formatSensitive: (value: number) => <span>{value.toFixed(2)}</span>,
}

const baseProps: ComponentProps<typeof LedgerServerStatus> = {
  currentPage: 1,
  error: null,
  isFetching: false,
  syncingTransactions: [transaction('syncing-1', -25)],
  listProps,
  onRetry: () => {},
}

describe('LedgerServerStatus syncing panel', () => {
  afterEach(cleanup)

  it('totals the rows it is actually showing, not the server page', () => {
    render(<LedgerServerStatus {...baseProps} />)

    const panel = screen.getByLabelText('Syncing changes').closest('section')
    expect(panel).not.toBeNull()

    // The one syncing row is 25. Inheriting the server page's figures put its 900 under a
    // heading that counts the syncing rows.
    expect(within(panel as HTMLElement).getAllByText('25.00').length).toBeGreaterThan(0)
    expect(within(panel as HTMLElement).queryByText('900.00')).toBeNull()
  })
})
