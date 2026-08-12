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
  pageTotals: { inflow: number; outflow: number; transfer: number; bucket: string | null; bucketNet: number }
  isTxDeleting: (id: string) => boolean
  isTxSyncing: (id: string) => boolean
  onStartEdit: (t: Transaction) => void
  onDeleteClick: (t: Transaction) => void
  onEditBlocked: (t: Transaction) => void
  isSelecting?: boolean
  isSelected?: (t: Transaction) => boolean
  canSelect?: (t: Transaction) => boolean
  onToggleSelected?: (t: Transaction) => void
  formatSensitive: (val: number) => ReactNode
}
