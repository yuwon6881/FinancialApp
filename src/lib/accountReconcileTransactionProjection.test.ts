import { describe, expect, it } from 'vitest'
import { buildAccountReconcileTransactions } from './accountReconcileTransactionProjection'

describe('buildAccountReconcileTransactions', () => {
  it('projects the server adjustment and account move rows', () => {
    const rows = buildAccountReconcileTransactions({
      operationId: 'setup-1',
      createdAt: Date.parse('2026-08-13T00:00:00Z'),
      bucket: 'Essentials',
      expectedBucketTotal: 100,
      adjustmentAccountId: 'main',
      targets: [
        { id: 'main', expectedCurrent: 100, target: 80, isArchived: false },
        { id: 'cash', expectedCurrent: 0, target: 30, isArchived: false },
      ],
    })

    expect(rows).toEqual([
      expect.objectContaining({ id: 'reconcile-setup-1-adjustment', amount: 10, accountId: 'main' }),
      expect.objectContaining({ id: 'reconcile-setup-1-move-0', amount: 30, accountId: 'main', counterAccountId: 'cash' }),
    ])
  })
})
