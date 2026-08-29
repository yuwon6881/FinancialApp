import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FailedSyncModal } from './FailedSyncModal'

describe('FailedSyncModal', () => {
  it('uses readable labels without exposing internal entity ids', () => {
    render(
      <FailedSyncModal
        isOpen
        failedOps={[{
          id: 'op-1',
          entity: 'investmentCashFlow',
          type: 'add',
          targetId: 'c25ed475-0ed2-419c-a799-5a7bfe01cfce',
          payload: { type: 'Conversion', currency: 'MYR', amount: 1000, date: '2026-06-01' },
          createdAt: Date.now(),
          retryCount: 1,
          lastError: 'Insufficient MYR cash in this account.',
        }]}
        onClose={vi.fn()}
        onDiscard={vi.fn()}
        onDiscardAll={vi.fn()}
      />,
    )

    expect(screen.getAllByText('Cash movement').length).toBeGreaterThan(0)
    expect(screen.queryByText('investmentCashFlow')).toBeNull()
    expect(screen.queryByText('c25ed475-0ed2-419c-a799-5a7bfe01cfce')).toBeNull()
  })

  it('formats reconciliation objects without rendering [object Object]', () => {
    render(
      <FailedSyncModal
        isOpen
        failedOps={[{
          id: 'op-reconcile-1',
          entity: 'ledgerAccount',
          type: 'reconcile' as never,
          targetId: 'Stability',
          payload: {
            name: 'Stability account reconciliation',
            description: 'Reconcile Stability account balances',
            reconciliation: {
              bucket: 'Stability',
              targets: [{ accountId: 'acc-1', balance: 500 }],
            },
            undoReconciliation: {
              bucket: 'Stability',
              targets: [{ accountId: 'acc-1', balance: 400 }],
            },
          },
          createdAt: Date.now(),
          retryCount: 5,
          lastError: 'Could not reconcile ledger accounts.',
        }]}
        onClose={vi.fn()}
        onDiscard={vi.fn()}
        onDiscardAll={vi.fn()}
      />,
    )

    expect(screen.queryByText(/\[object Object\]/)).toBeNull()
    expect(screen.getByText('Stability (1 account)')).not.toBeNull()
    expect(screen.queryByText(/Undo Reconciliation/i)).toBeNull()
  })

  it('retries a failed operation but directs account-review failures to their fix', () => {
    const onRetry = vi.fn()
    render(
      <FailedSyncModal
        isOpen
        failedOps={[
          { id: 'retry-me', entity: 'transaction', type: 'add', targetId: '1', createdAt: 1, retryCount: 5 },
          { id: 'review-me', entity: 'transaction', type: 'add', targetId: '2', createdAt: 2, retryCount: 1, needsAccountReview: true },
        ]}
        onClose={vi.fn()}
        onDiscard={vi.fn()}
        onDiscardAll={vi.fn()}
        onRetry={onRetry}
        onOpenAccountReview={vi.fn()}
      />,
    )

    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledWith('retry-me')
  })

  it('suppresses optimisticTransaction and shows curated recurring fields', () => {
    render(
      <FailedSyncModal
        isOpen
        failedOps={[{
          id: 'op-recurring-1',
          entity: 'recurringPayment',
          type: 'settle' as never,
          targetId: 'rp-1',
          payload: {
            name: 'HouseHold',
            amount: 720,
            occurrenceDate: '2026-08-28',
            paidDate: '2026-08-28',
            status: 'Paid',
            category: 'HouseHold',
            ledgerCategory: 'Essentials',
            optimisticNextOccurrenceDate: '2026-10-28',
            optimisticTransaction: {
              date: '2026-08-28',
              postedAt: '2026-08-29T04:22:51.254Z',
              description: 'HouseHold',
              amount: -720,
              category: 'HouseHold',
              ledgerCategory: 'Essentials',
              recurringOccurrenceDate: '2026-08-28',
              isPendingSync: true,
            },
          },
          createdAt: Date.now(),
          retryCount: 1,
          needsAccountReview: true,
        }]}
        onClose={vi.fn()}
        onDiscard={vi.fn()}
        onDiscardAll={vi.fn()}
        onOpenAccountReview={vi.fn()}
      />,
    )

    // optimisticTransaction dump must not appear
    expect(screen.queryByText(/Is Pending Sync/i)).toBeNull()
    expect(screen.queryByText(/Posted At/i)).toBeNull()
    expect(screen.queryByText(/2026-08-29T04:22:51/)).toBeNull()

    // Curated fields should be present with formatted dates
    expect(screen.getByText('720')).not.toBeNull()
    // 'Paid' appears as both the date field label and the status badge
    expect(screen.getAllByText('Paid').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Essentials')).not.toBeNull()
    // 'HouseHold' appears as the card title and the category value
    expect(screen.getAllByText('HouseHold').length).toBeGreaterThanOrEqual(2)
  })

  it('formats dates as human-readable text', () => {
    render(
      <FailedSyncModal
        isOpen
        failedOps={[{
          id: 'op-date-1',
          entity: 'transaction',
          type: 'add',
          targetId: 'tx-1',
          payload: {
            description: 'Groceries',
            amount: -50,
            date: '2026-08-28',
            category: 'Food',
            ledgerCategory: 'Essentials',
          },
          createdAt: Date.now(),
          retryCount: 3,
        }]}
        onClose={vi.fn()}
        onDiscard={vi.fn()}
        onDiscardAll={vi.fn()}
      />,
    )

    // Raw ISO date should not appear; formatted date should
    expect(screen.queryByText('2026-08-28')).toBeNull()
    // The formatted date depends on locale, but it should contain 2026
    const dateElements = screen.getAllByText(/2026/)
    expect(dateElements.length).toBeGreaterThan(0)
  })
})
