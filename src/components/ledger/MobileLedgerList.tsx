import { ArrowRightLeft } from 'lucide-react'
import { MobileLedgerRow } from './LedgerRows'
import type { LedgerListProps } from './ledgerListShared'
import { hasDistinctBucketMovement } from '../../lib/ledgerTotals'
import { LedgerEmptyState } from './LedgerEmptyState'
import { Skeleton } from '../ui/Skeleton'

// Mobile (< md) ledger card list — swipe a row left to reveal Edit / Delete.
// Mounted below the expanded tier, so the desktop table's row tree,
// motion components and SwipeableRows are never instantiated alongside it.
export function MobileLedgerList({
  transactions,
  listKey,
  hideSensitive,
  maskFinancialFigures,
  currency,
  serverIsFetching,
  serverIsLoadingRows = false,
  loadingRowCount = 5,
  pageTotals,
  isTxDeleting,
  isTxSyncing,
  onStartEdit,
  accounts,
  onDeleteClick,
  onEditBlocked,
  onMove,
  hasAnyFilter,
  onResetFilters,
  onAddTransaction,
  isSelecting = false,
  isSelected = () => false,
  canSelect = () => false,
  onToggleSelected = () => undefined,
  formatSensitive,
}: LedgerListProps) {
  const hasRows = transactions.length > 0
  const net = pageTotals.inflow - pageTotals.outflow
  return (
    // Entrance is CSS (.list-container-enter / .list-row-enter); `key` still remounts
    // the list so a cycle/page change replays it. See DesktopLedgerTable for why the
    // AnimatePresence went away with the motion components.
    <div
      key={listKey}
      className="list-container-enter grid w-full grid-cols-1 gap-3 lg:grid-cols-2"
    >
      {transactions.map((t, idx) => (
        <MobileLedgerRow
          key={t.id}
          transaction={t}
          accounts={accounts}
          index={idx}
          hint={idx === 0}
          isDeleting={isTxDeleting(t.id)}
          isSyncing={isTxSyncing(t.id)}
          hideSensitive={hideSensitive}
          maskFinancialFigures={maskFinancialFigures}
          currency={currency}
          onStartEdit={onStartEdit}
          onDeleteClick={onDeleteClick}
          onEditBlocked={onEditBlocked}
          onMove={onMove}
          isSelecting={isSelecting}
          isSelected={isSelected}
          canSelect={canSelect}
          onToggleSelected={onToggleSelected}
        />
      ))}
      {hasRows && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card p-4 text-xs shadow-xs select-none lg:col-span-2">
          <div className="text-xs font-extrabold text-foreground uppercase tracking-wider border-b border-border/30 pb-2.5 mb-1">Page Total Summary</div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-semibold">Total Outflow (Debit)</span>
            <span className="text-orange-500 font-bold text-sm">{formatSensitive(pageTotals.outflow)}</span>
          </div>
          <div className="flex justify-between items-center border-t border-border/30 pt-2.5">
            <span className="text-muted-foreground font-semibold">Total Inflow (Credit)</span>
            <span className="text-emerald-500 font-bold text-sm">{formatSensitive(pageTotals.inflow)}</span>
          </div>
          {pageTotals.transfer > 0 && (
            <div className="border-t border-border/30 pt-2.5">
              <div className="flex justify-between items-center">
                <span className="text-blue-500 font-semibold flex items-center gap-1.5">
                  <ArrowRightLeft className="size-3.5" /> Transferred / Allocated
                </span>
                <span className="text-blue-500 font-bold text-sm">{formatSensitive(pageTotals.transfer)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Internal movement between buckets — excluded from debit and credit.
              </p>
            </div>
          )}
          {pageTotals.bucket && hasDistinctBucketMovement(pageTotals.bucketNet, net) ? (
            <div className="border-t border-border/30 pt-2.5">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold">{pageTotals.bucket} movement on this page</span>
                <span className={`font-bold text-sm ${pageTotals.bucketNet >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                  {pageTotals.bucketNet >= 0 ? '+' : '-'}{formatSensitive(Math.abs(pageTotals.bucketNet))}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                What went in minus what came out, counting each row's share of this bucket.
              </p>
            </div>
          ) : (
            <div className="flex justify-between items-center border-t border-border/50 pt-2.5 font-bold">
              <span className="text-foreground">Net Position</span>
              <span className={`${net >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                {net >= 0 ? '+' : '-'}
                {formatSensitive(Math.abs(net))}
              </span>
            </div>
          )}
        </div>
      )}

      {serverIsLoadingRows && Array.from({ length: loadingRowCount }).map((_, index) => (
        <div
          key={`loading-${index}`}
          aria-hidden="true"
          className="space-y-2.5 rounded-xl border border-border/60 bg-card p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}

      {!hasRows && !serverIsLoadingRows && (
        <div className="list-row-enter rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground lg:col-span-2">
          {serverIsFetching ? 'Loading…' : <LedgerEmptyState isFiltered={hasAnyFilter} onResetFilters={onResetFilters} onAddTransaction={onAddTransaction} />}
        </div>
      )}
    </div>
  )
}
