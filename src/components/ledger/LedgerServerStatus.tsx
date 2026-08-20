import { AlertCircle, RefreshCw, UploadCloud } from 'lucide-react'
import type { Transaction } from '../../types'
import { Button } from '../ui/Button'
import { LedgerTransactionList } from './LedgerTransactionList'
import type { LedgerListProps } from './ledgerListShared'

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
  return (
    <div className="space-y-3">
      {error && (
        <section className="app-panel flex flex-col gap-3 rounded-2xl border border-orange-500/30 bg-card/92 p-4 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="ledger-load-error">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-orange-500" />
            <div>
              <h3 id="ledger-load-error" className="text-sm font-semibold text-foreground">Saved transactions are unavailable</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onRetry} disabled={isFetching} className="shrink-0 rounded-xl">
            <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Try again
          </Button>
        </section>
      )}

      {syncingTransactions.length > 0 && currentPage === 1 && (
        <section className="app-panel space-y-3 rounded-2xl border border-border/60 bg-card/92 p-4" aria-labelledby="ledger-syncing-heading">
          <div className="flex items-start gap-2">
            <UploadCloud className="mt-0.5 size-4 shrink-0 text-accent-ink" />
            <div>
              <h3 id="ledger-syncing-heading" className="text-sm font-semibold text-foreground">Syncing changes</h3>
              <p className="text-xs text-muted-foreground">These matching entries appear once here until the server confirms them. Saved result totals and pages stay authoritative.</p>
            </div>
          </div>
          <LedgerTransactionList {...listProps} transactions={syncingTransactions} listKey={`${listProps.listKey}-syncing`} />
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
