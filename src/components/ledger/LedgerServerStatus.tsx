import { useMemo } from 'react'
import { AlertCircle, RefreshCw, UploadCloud } from 'lucide-react'
import type { Transaction } from '../../types'
import { calculateLedgerTotals } from '../../lib/ledgerTotals'
import { Button } from '../ui/Button'
import { LedgerTransactionList } from './LedgerTransactionList'
import type { LedgerListProps } from './ledgerListShared'
import { cn } from '../../lib/utils'
import { PANEL_TONES, panelClass } from '../ui/panelStyles'

interface LedgerServerStatusProps {
  currentPage: number
  error: string | null
  isFetching: boolean
  syncingTransactions: Transaction[]
  listProps: LedgerListProps
  onRetry: () => void
}

export function LedgerServerStatus({
  currentPage,
  error,
  isFetching,
  syncingTransactions,
  listProps,
  onRetry,
}: LedgerServerStatusProps) {
  // The bucket travels on the server page's totals because it comes from the active filter, not
  // from the rows; only the amounts have to be re-derived.
  const syncingTotals = useMemo(
    () => calculateLedgerTotals(syncingTransactions, listProps.pageTotals.bucket),
    [syncingTransactions, listProps.pageTotals.bucket])

  return (
    <div className="space-y-3">
      {error && (
        <section className={cn(panelClass, PANEL_TONES.urgent, 'flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between')} aria-labelledby="ledger-load-error">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-orange-500" />
            <div>
              <h3 id="ledger-load-error" className="text-subsection text-foreground">Saved transactions are unavailable</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onRetry} disabled={isFetching} className="shrink-0 rounded-xl">
            <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Try again
          </Button>
        </section>
      )}

      {syncingTransactions.length > 0 && currentPage === 1 && (
        <section className={cn(panelClass, 'space-y-3 p-4')} aria-labelledby="ledger-syncing-heading">
          <div className="flex items-start gap-2">
            <UploadCloud className="mt-0.5 size-4 shrink-0 text-accent-ink" />
            <div>
              <h3 id="ledger-syncing-heading" className="text-subsection text-foreground">Syncing changes</h3>
              <p className="text-xs text-muted-foreground">These matching entries appear once here until the server confirms them. Saved result totals and pages stay authoritative.</p>
            </div>
          </div>
          {/* Locally queued rows are already in hand, so a server page fetch must not replace them
              with placeholders. The totals are recomputed over these rows: the list footer labels
              itself "Page Total (N items)", and inheriting the server page's figures put that
              count and those amounts on two different sets of rows. */}
          <LedgerTransactionList
            {...listProps}
            transactions={syncingTransactions}
            pageTotals={syncingTotals}
            serverIsLoadingRows={false}
            listKey={`${listProps.listKey}-syncing`}
          />
        </section>
      )}

      {syncingTransactions.length > 0 && currentPage > 1 && (
        <p className="text-xs text-muted-foreground">
          {syncingTransactions.length} matching change{syncingTransactions.length === 1 ? '' : 's'} syncing; review on page 1.
        </p>
      )}
    </div>
  )
}
