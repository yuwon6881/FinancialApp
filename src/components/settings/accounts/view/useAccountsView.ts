import { useMemo } from 'react'
import type { LedgerAccount } from '../../../../types'
import { useSyncStatus } from '../../../../lib/useOptimisticList'

interface UseAccountsViewOptions {
  accounts: LedgerAccount[]
  activeSyncId?: string | null
  activeSyncIds?: ReadonlyArray<string>
  deletingId?: string | null
}

export function useAccountsView({ accounts, activeSyncId, activeSyncIds, deletingId }: UseAccountsViewOptions) {
  const rows = useMemo(
    () => [...accounts].sort((left, right) =>
      left.bucket.localeCompare(right.bucket) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    [accounts],
  )
  const { isSyncing, isDeleting } = useSyncStatus(
    rows,
    activeSyncIds?.length ? activeSyncIds : activeSyncId,
    deletingId,
  )
  return { rows, isSyncing, isDeleting }
}
