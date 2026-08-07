import { useCallback, useMemo } from 'react'
import { applyOpsToList, type ApplyOpsOptions, type QueuedOp, type EntityKind } from './outbox'

// Applies the pending/recently-completed sync queue on top of a server-fetched
// list so optimistic adds/updates/deletes show immediately. Same useMemo shape
// (deps: [activeOps, list]) as the call sites it replaces, kept identical so it
// doesn't change how the React Compiler treats this memoization.
export function useOptimisticList<T extends { id: string | number; isPendingSync?: boolean; isPendingDelete?: boolean }>(
  list: T[],
  activeOps: QueuedOp[],
  entity: EntityKind,
  options?: ApplyOpsOptions
): T[] {
  return useMemo(() => applyOpsToList(list, activeOps, entity, options), [activeOps, list, options])
}

// Shared isSyncing/isDeleting row-status predicates, previously copy-pasted per
// view (WishlistView's isItemSyncing/isItemDeleting, RecurringPaymentsView's
// isPaymentSyncing/isPaymentDeleting) with identical logic against different lists.
export function useSyncStatus<T extends { id: string | number; isPendingDelete?: boolean; pendingSyncOperationId?: string }>(
  list: T[],
  activeSyncId: string | number | ReadonlyArray<string | number> | null | undefined,
  deletingId: string | number | null | undefined
) {
  const { syncingIds, deletingIds } = useMemo(() => {
    const activeSyncIds = new Set(
      Array.isArray(activeSyncId)
        ? activeSyncId.map(String)
        : activeSyncId === null || activeSyncId === undefined ? [] : [String(activeSyncId)],
    )
    const syncingIds = new Set(activeSyncIds)
    const deletingIds = new Set<string>()

    if (deletingId !== null && deletingId !== undefined) deletingIds.add(String(deletingId))
    for (const item of list) {
      const itemId = String(item.id)
      if (item.isPendingDelete) deletingIds.add(itemId)
      if (item.pendingSyncOperationId && activeSyncIds.has(item.pendingSyncOperationId)) syncingIds.add(itemId)
    }

    return { syncingIds, deletingIds }
  }, [activeSyncId, deletingId, list])

  const isSyncing = useCallback((id: string | number) => {
    return syncingIds.has(String(id))
  }, [syncingIds])

  const isDeleting = useCallback((id: string | number) => {
    return deletingIds.has(String(id))
  }, [deletingIds])

  return { isSyncing, isDeleting }
}
