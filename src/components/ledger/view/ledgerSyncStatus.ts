type LedgerSyncTransaction = {
  id: string
  isPendingDelete?: boolean
  pendingSyncOperationId?: string
}

type LedgerSyncStatusOptions = {
  transactions: readonly LedgerSyncTransaction[]
  activeSyncId?: string | null
  activeSyncIds?: ReadonlyArray<string>
  deletingTxId?: string | null
}

const splitParentId = (transactionId: string) => {
  const splitMarker = transactionId.indexOf('-split-')
  return splitMarker < 0 ? null : transactionId.slice(0, splitMarker)
}

export function createLedgerSyncStatus({
  transactions,
  activeSyncId,
  activeSyncIds,
  deletingTxId,
}: LedgerSyncStatusOptions) {
  const effectiveSyncIds = activeSyncIds?.length ? activeSyncIds : activeSyncId ? [activeSyncId] : []
  const activeSyncSet = new Set(effectiveSyncIds)
  const directDeleteSet = new Set([deletingTxId].filter((id): id is string => Boolean(id)))
  const syncingTransactionIds = new Set<string>()
  const deletingTransactionIds = new Set<string>()

  const isDirectSyncTarget = (transactionId: string) => {
    if (activeSyncSet.has(transactionId)) return true
    if (transactionId.startsWith('wishlist-purchase-')
      && activeSyncSet.has(transactionId.slice('wishlist-purchase-'.length))) return true
    const parentId = splitParentId(transactionId)
    return parentId !== null && activeSyncSet.has(parentId)
  }

  const isDirectDeleteTarget = (transactionId: string) => {
    if (directDeleteSet.has(transactionId)) return true
    const parentId = splitParentId(transactionId)
    return parentId !== null && directDeleteSet.has(parentId)
  }

  for (const transaction of transactions) {
    if (transaction.isPendingDelete || isDirectDeleteTarget(transaction.id)) {
      deletingTransactionIds.add(transaction.id)
    }
    if (isDirectSyncTarget(transaction.id)
      || Boolean(transaction.pendingSyncOperationId && activeSyncSet.has(transaction.pendingSyncOperationId))) {
      syncingTransactionIds.add(transaction.id)
    }
  }

  return {
    isDeleting: (transactionId: string) => deletingTransactionIds.has(transactionId) || isDirectDeleteTarget(transactionId),
    isSyncing: (transactionId: string) => syncingTransactionIds.has(transactionId) || isDirectSyncTarget(transactionId),
  }
}
