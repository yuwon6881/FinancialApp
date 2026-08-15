import { useMemo } from 'react'
import type { LedgerAccount } from '../../../../types'
import { useSyncStatus } from '../../../../lib/useOptimisticList'
import { BUCKET_DEFINITIONS } from '../accountOptions'

export interface BucketGroupSummary {
  bucket: LedgerAccount['bucket']
  description: string
  accounts: LedgerAccount[]
  allBucketAccounts: LedgerAccount[]
  openCount: number
  archivedCount: number
  balance: number
}

export interface UseAccountsViewOptions {
  accounts: LedgerAccount[]
  activeSyncId?: string | null
  activeSyncIds?: ReadonlyArray<string>
  deletingId?: string | null
  searchQuery?: string
}

export function useAccountsView({
  accounts,
  activeSyncId,
  activeSyncIds,
  deletingId,
  searchQuery = '',
}: UseAccountsViewOptions) {
  const rows = useMemo(
    () => [...accounts].sort((left, right) =>
      left.bucket.localeCompare(right.bucket) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    [accounts],
  )

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredRows = useMemo(() => {
    if (!normalizedQuery) return rows
    return rows.filter(account =>
      account.name.toLowerCase().includes(normalizedQuery)
      || account.kind.toLowerCase().includes(normalizedQuery),
    )
  }, [normalizedQuery, rows])

  const bucketGroups = useMemo<BucketGroupSummary[]>(() => {
    return BUCKET_DEFINITIONS.map(bucketDef => {
      const allBucketAccounts = rows.filter(item => item.bucket === bucketDef.name)
      const filteredAccounts = filteredRows.filter(item => item.bucket === bucketDef.name)
      const openCount = allBucketAccounts.filter(item => !item.isArchived).length
      const archivedCount = allBucketAccounts.length - openCount
      const balance = allBucketAccounts.reduce((total, item) => total + item.remaining, 0)

      return {
        bucket: bucketDef.name,
        description: bucketDef.description,
        accounts: filteredAccounts,
        allBucketAccounts,
        openCount,
        archivedCount,
        balance,
      }
    })
  }, [filteredRows, rows])

  const openAccountCount = useMemo(() => rows.filter(item => !item.isArchived).length, [rows])
  const archivedAccountCount = rows.length - openAccountCount

  const { isSyncing, isDeleting } = useSyncStatus(
    rows,
    activeSyncIds?.length ? activeSyncIds : activeSyncId,
    deletingId,
  )

  return {
    rows,
    filteredRows,
    bucketGroups,
    openAccountCount,
    archivedAccountCount,
    isSyncing,
    isDeleting,
  }
}
