import { ArrowRightLeft } from 'lucide-react'
import { MobileLedgerRow } from './LedgerRows'
import type { LedgerListProps } from './ledgerListShared'

// Mobile (< md) ledger card list — swipe a row left to reveal Edit / Delete.
// Mounted only when useIsMobile() is true, so the desktop table's row tree,
// motion components and SwipeableRows are never instantiated alongside it.
export function MobileLedgerList({
  transactions,
  listKey,
  hideSensitive,
  currency,
  serverIsFetching,
  pageTotals,
  isTxDeleting,
  isTxSyncing,
  onStartEdit,
  onDeleteClick,
  onSplitEditBlocked,
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
      className="list-container-enter space-y-3 w-full"
    >
      {transactions.map((t, idx) => (
        <MobileLedgerRow
          key={t.id}
          transaction={t}
          index={idx}
          hint={idx === 0}
          isDeleting={isTxDeleting(t.id)}
          isSyncing={isTxSyncing(t.id)}
          hideSensitive={hideSensitive}
          currency={currency}
          onStartEdit={onStartEdit}
          onDeleteClick={onDeleteClick}
          onSplitEditBlocked={onSplitEditBlocked}
        />
      ))}
      {hasRows && (
        <div className="flex flex-col gap-2.5 p-4 bg-card border border-border/60 rounded-xl text-xs shadow-xs select-none">
          <div className="text-xs font-extrabold text-foreground/80 uppercase tracking-wider border-b border-border/30 pb-2.5 mb-1">Page Total Summary</div>
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
              <p className="mt-1 text-[10px] text-muted-foreground">
                Internal movement between buckets — excluded from debit, credit and the net position below.
              </p>
            </div>
          )}
          <div className="flex justify-between items-center border-t border-border/50 pt-2.5 font-bold">
            <span className="text-foreground">Net Position</span>
            <span className={`${net >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
              {net >= 0 ? '+' : '-'}
              {formatSensitive(Math.abs(net))}
            </span>
          </div>
        </div>
      )}

      {!hasRows && (
        <div className="list-row-enter p-8 text-center text-muted-foreground text-sm border rounded-xl bg-card">
          {serverIsFetching ? 'Loading...' : 'No transactions match your criteria.'}
        </div>
      )}
    </div>
  )
}
