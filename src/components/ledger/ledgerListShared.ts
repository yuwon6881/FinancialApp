import type { ReactNode } from 'react'
import type { LedgerAccount, Transaction } from '../../types'

// Props shared by the desktop table and the mobile card list. Only one of the two
// is mounted at a time (see LedgerTransactionList), so they must stay interchangeable.
export interface LedgerListProps {
  transactions: Transaction[]
  accounts?: LedgerAccount[]
  // Remount key so a cycle/page/mode change replays the list entrance animation.
  listKey: string
  hideSensitive: boolean
  currency: string
  serverIsFetching: boolean
  /**
   * A server fetch whose result replaces the rows currently on screen (page turn, page size,
   * filters, sort). The list shows placeholders for it, because the rows it still holds belong to
   * a query the user has already left.
   */
  serverIsLoadingRows?: boolean
  /** Placeholder count while loading, so the list keeps roughly the height it is heading for. */
  loadingRowCount?: number
  pageTotals: { inflow: number; outflow: number; transfer: number; bucket: string | null; bucketNet: number }
  isTxDeleting: (id: string) => boolean
  isTxSyncing: (id: string) => boolean
  onStartEdit: (t: Transaction) => void
  onDeleteClick: (t: Transaction) => void
  onEditBlocked: (t: Transaction) => void
  onDuplicate?: (t: Transaction) => void
  hasAnyFilter: boolean
  onResetFilters: () => void
  onAddTransaction: () => void
  isSelecting?: boolean
  isSelected?: (t: Transaction) => boolean
  canSelect?: (t: Transaction) => boolean
  onToggleSelected?: (t: Transaction) => void
  formatSensitive: (val: number) => ReactNode
}
