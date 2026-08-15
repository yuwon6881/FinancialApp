import { describe, expect, it } from 'vitest'
import { buildAccountReconcileTransactions } from './accountReconcileTransactionProjection'

describe('buildAccountReconcileTransactions', () => {
  it('projects one balance adjustment row for each changed account', () => {
    const rows = buildAccountReconcileTransactions({
      operationId: 'setup-1',
      createdAt: Date.parse('2026-08-13T00:00:00Z'),
      bucket: 'Essentials',
      expectedBucketTotal: 100,
      targets: [
        { id: 'main', name: 'Main account', expectedCurrent: 100, target: 80, isArchived: false },
        { id: 'cash', name: 'Cash', expectedCurrent: 0, target: 30, isArchived: false },
      ],
    })

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'reconcile-setup-1-adjustment-0',
        amount: -20,
        accountId: 'main',
        description: 'Account balance adjustment - Main account',
        isAccountBalanceAdjustment: true,
      }),
      expect.objectContaining({
        id: 'reconcile-setup-1-adjustment-1',
        amount: 30,
        accountId: 'cash',
        description: 'Account balance adjustment - Cash',
        isAccountBalanceAdjustment: true,
      }),
    ])
  })
})
