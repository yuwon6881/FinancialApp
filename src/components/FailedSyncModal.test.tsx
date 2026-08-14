import { render, screen } from '@testing-library/react'
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
})