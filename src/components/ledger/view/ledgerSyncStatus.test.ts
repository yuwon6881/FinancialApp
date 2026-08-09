import { describe, expect, it } from 'vitest'
import { createLedgerSyncStatus } from './ledgerSyncStatus'

describe('createLedgerSyncStatus', () => {
  it('indexes pending row state and operation ids', () => {
    const status = createLedgerSyncStatus({
      transactions: [
        { id: 'pending-delete', isPendingDelete: true },
        { id: 'pending-sync', pendingSyncOperationId: 'op-1' },
        { id: 'idle' },
      ],
      activeSyncIds: ['op-1'],
    })

    expect(status.isDeleting('pending-delete')).toBe(true)
    expect(status.isSyncing('pending-sync')).toBe(true)
    expect(status.isDeleting('idle')).toBe(false)
    expect(status.isSyncing('idle')).toBe(false)
  })

  it('preserves direct, wishlist-purchase, and split-row sync aliases', () => {
    const status = createLedgerSyncStatus({ transactions: [], activeSyncIds: ['tx-1', 'wish-1'] })

    expect(status.isSyncing('tx-1')).toBe(true)
    expect(status.isSyncing('wishlist-purchase-wish-1')).toBe(true)
    expect(status.isSyncing('tx-1-split-2')).toBe(true)
  })

  it('preserves transaction deletion aliases for server-paged rows', () => {
    const status = createLedgerSyncStatus({
      transactions: [],
      deletingTxId: 'tx-1',
    })

    expect(status.isDeleting('tx-1-split-1')).toBe(true)
    expect(status.isDeleting('tx-3')).toBe(false)
  })
})
