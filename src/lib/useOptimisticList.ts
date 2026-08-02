import { useCallback, useMemo } from 'react'
import { applyOpsToList, type QueuedOp, type EntityKind } from './outbox'

// Applies the pending/recently-completed sync queue on top of a server-fetched
// list so optimistic adds/updates/deletes show immediately. Same useMemo shape
// (deps: [activeOps, list]) as the call sites it replaces, kept identical so it
// doesn't change how the React Compiler treats this memoization.
export function useOptimisticList<T extends { id: string | number; isPendingSync?: boolean; isPendingDelete?: boolean }>(
  list: T[],
  activeOps: QueuedOp[],
  entity: EntityKind
): T[] {
  return useMemo(() => applyOpsToList(list, activeOps, entity), [activeOps, list])
}

// Shared isSyncing/isDeleting row-status predicates, previously copy-pasted per
// view (WishlistView's isItemSyncing/isItemDeleting, RecurringPaymentsView's
// isPaymentSyncing/isPaymentDeleting) with identical logic against different lists.
export function useSyncStatus<T extends { id: string | number; isPendingDelete?: boolean; pendingSyncOperationId?: string }>(
  list: T[],
  activeSyncId: string | number | ReadonlyArray<string | number> | null | undefined,
  deletingId: string | number | null | undefined
) {
  const activeSyncIds = useMemo(() => {
    if (Array.isArray(activeSyncId)) return activeSyncId.map(String)
    return activeSyncId === null || activeSyncId === undefined ? [] : [String(activeSyncId)]
  }, [activeSyncId])

  const isSyncing = useCallback((id: string | number) => {
    if (activeSyncIds.includes(String(id))) return true
    const found = list.find(item => String(item.id) === String(id))
    return Boolean(found?.pendingSyncOperationId && activeSyncIds.includes(found.pendingSyncOperationId))
  }, [activeSyncIds, list])

  const isDeleting = useCallback((id: string | number) => {
    if (deletingId && String(deletingId) === String(id)) return true
    const found = list.find(item => String(item.id) === String(id))
    return Boolean(found?.isPendingDelete)
  }, [deletingId, list])

  return { isSyncing, isDeleting }
}
