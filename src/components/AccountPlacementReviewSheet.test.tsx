import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { LedgerAccount, RecurringPayment } from '../types'
import type { QueuedOp } from '../lib/outbox'
import { AccountPlacementReviewSheet } from './AccountPlacementReviewSheet'

const accounts: LedgerAccount[] = [
  {
    id: 'acct-essentials',
    name: 'Main Checking',
    bucket: 'Essentials',
    kind: 'Bank',
    isArchived: false,
    remaining: 100,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'acct-rewards',
    name: 'Treats Wallet',
    bucket: 'Rewards',
    kind: 'EWallet',
    isArchived: false,
    remaining: 50,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
]

const recurringPayments: RecurringPayment[] = [
  {
    id: 'rec-1',
    name: 'Internet',
    amount: 60,
    frequency: 'Monthly',
    category: 'Bills',
    ledgerCategory: 'Essentials',
    dueDate: 15,
    startDate: '2026-08-01',
    nextDueDate: '2026-08-15',
    active: true,
    paymentMode: 'Manual',
    accountId: 'acct-essentials',
  },
]

describe('AccountPlacementReviewSheet', () => {
  it('renders nothing when closed or no review operations exist', () => {
    const { rerender } = render(
      <AccountPlacementReviewSheet
        isOpen={false}
        failedOps={[]}
        accounts={accounts}
        recurringPayments={recurringPayments}
        onClose={vi.fn()}
        onResolve={vi.fn()}
      />,
    )
    expect(screen.queryByText('Review offline account placement')).toBeNull()

    rerender(
      <AccountPlacementReviewSheet
        isOpen={true}
        failedOps={[]}
        accounts={accounts}
        recurringPayments={recurringPayments}
        onClose={vi.fn()}
        onResolve={vi.fn()}
      />,
    )
    expect(screen.getByText(/No offline changes need account review/i)).toBeDefined()
  })

  it('renders failed ops carrying needsAccountReviewBuckets and resolves them', () => {
    const failedOp: QueuedOp = {
      id: 'op-ambiguous-tx',
      entity: 'transaction',
      type: 'add',
      targetId: 'tx-1',
      createdAt: 123456,
      retryCount: 3,
      needsAccountReview: true,
      needsAccountReviewBuckets: ['Essentials'],
      payload: {
        id: 'tx-1',
        description: 'Supermarket',
        amount: -50,
        ledgerCategory: 'Essentials',
        category: 'Food',
        date: '2026-08-15',
      },
    }

    const onResolve = vi.fn()
    render(
      <AccountPlacementReviewSheet
        isOpen={true}
        failedOps={[failedOp]}
        accounts={accounts}
        recurringPayments={recurringPayments}
        onClose={vi.fn()}
        onResolve={onResolve}
      />,
    )

    expect(screen.getByText('Supermarket')).toBeDefined()
    expect(screen.getByText('Essentials account')).toBeDefined()

    const select = screen.getByRole('combobox', { name: 'Essentials account' })
    fireEvent.click(select)
    fireEvent.click(screen.getByRole('option', { name: 'Main Checking (Essentials)' }))

    const requeueBtn = screen.getByRole('button', { name: 'Requeue this change' }) as HTMLButtonElement
    expect(requeueBtn.disabled).toBe(false)
    fireEvent.click(requeueBtn)

    expect(onResolve).toHaveBeenCalledWith(failedOp, { Essentials: 'acct-essentials' })
  })

  it('handles transfer operations requiring two account endpoints', () => {
    const transferOp: QueuedOp = {
      id: 'op-transfer',
      entity: 'transaction',
      type: 'add',
      targetId: 'tx-transfer',
      createdAt: 123456,
      retryCount: 1,
      needsAccountReview: true,
      payload: {
        id: 'tx-transfer',
        description: 'Savings move',
        amount: 30,
        ledgerCategory: 'Transfer:Essentials->Rewards',
        category: 'Transfer',
        date: '2026-08-15',
      },
    }

    const onResolve = vi.fn()
    render(
      <AccountPlacementReviewSheet
        isOpen={true}
        failedOps={[transferOp]}
        accounts={accounts}
        recurringPayments={recurringPayments}
        onClose={vi.fn()}
        onResolve={onResolve}
      />,
    )

    expect(screen.getByText('Essentials source account')).toBeDefined()
    expect(screen.getByText('Rewards destination account')).toBeDefined()

    const sourceSelect = screen.getByRole('combobox', { name: 'Essentials source account' })
    const destSelect = screen.getByRole('combobox', { name: 'Rewards destination account' })

    const requeueBtn = screen.getByRole('button', { name: 'Requeue this change' }) as HTMLButtonElement
    expect(requeueBtn.disabled).toBe(true)

    fireEvent.click(sourceSelect)
    fireEvent.click(screen.getByRole('option', { name: 'Main Checking (Essentials)' }))
    expect(requeueBtn.disabled).toBe(true)

    fireEvent.click(destSelect)
    fireEvent.click(screen.getByRole('option', { name: 'Treats Wallet (Rewards)' }))
    expect(requeueBtn.disabled).toBe(false)

    fireEvent.click(requeueBtn)
    expect(onResolve).toHaveBeenCalledWith(transferOp, {
      Essentials: 'acct-essentials',
      Rewards: 'acct-rewards',
    })
  })
})
