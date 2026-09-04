import { ArrowRightLeft } from 'lucide-react'
import { DataTable, DataTableBody, DataTableHeader, DataTableHeaderCell } from '../ui/DataTable'
import { DesktopLedgerRow } from './LedgerRows'
import type { LedgerListProps } from './ledgerListShared'
import { hasDistinctBucketMovement } from '../../lib/ledgerTotals'
import { LedgerEmptyState } from './LedgerEmptyState'
import { Skeleton } from '../ui/Skeleton'

// Desktop (>= md) ledger table, including the page-total summary rows and the
// empty/loading state. Mounted only in the expanded tier, so a phone never
// builds these 7-cell rows. Rows themselves are memoized in LedgerRows.
export function DesktopLedgerTable({
  transactions,
  listKey,
  hideSensitive,
  maskFinancialFigures,
  currency,
  serverIsFetching,
  serverIsLoadingRows = false,
  loadingRowCount = 6,
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
    <DataTable>
      <DataTableHeader>
        {isSelecting && <DataTableHeaderCell className="w-12">Select</DataTableHeaderCell>}
        <DataTableHeaderCell>Date</DataTableHeaderCell>
        <DataTableHeaderCell>Description</DataTableHeaderCell>
        <DataTableHeaderCell>Category</DataTableHeaderCell>
        <DataTableHeaderCell>Ledger Allocation</DataTableHeaderCell>
        <DataTableHeaderCell className="text-right text-orange-600 dark:text-orange-400 font-bold">Debit (Outflow)</DataTableHeaderCell>
        <DataTableHeaderCell className="text-right text-emerald-600 dark:text-emerald-400 font-bold">Credit (Inflow)</DataTableHeaderCell>
        <DataTableHeaderCell className="text-center">Actions</DataTableHeaderCell>
      </DataTableHeader>
          {/* The entrance is CSS (see .list-container-enter / .list-row-enter in
              index.css); `key` still remounts the body so a cycle/page change replays it.
              The AnimatePresence that used to wrap these rows is gone with the motion
              components: rowFadeVariants never defined an `exit`, so it was holding a
              presence context open for an exit animation that never existed. */}
      <DataTableBody
        key={listKey}
        className="list-container-enter"
      >
            {transactions.map((t, idx) => (
              <DesktopLedgerRow
                key={t.id}
                index={idx}
                transaction={t}
                accounts={accounts}
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
              <tr className="bg-muted/25 font-bold border-t-2 border-border text-xs select-none">
                <td className="p-4 align-middle" colSpan={isSelecting ? 5 : 4}>
                  <span className="text-eyebrow uppercase text-foreground">
                    Page Total <span className="text-muted-foreground font-bold normal-case tracking-normal">({transactions.length} items)</span>
                  </span>
                </td>
                {/* Wrapped in the same pill shape as the row values so the totals line up exactly
                    under each column (plain text sat ~0.6rem further right than the pill text),
                    with a ring + stronger fill to read clearly as the column total. */}
                <td className="p-4 text-right">
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-orange-500/15 ring-1 ring-inset ring-orange-500/40 text-orange-600 dark:text-orange-400 font-extrabold text-xs">
                    {formatSensitive(pageTotals.outflow)}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs">
                    {formatSensitive(pageTotals.inflow)}
                  </span>
                </td>
                <td className="p-4"></td>
              </tr>
            )}
            {/* Secondary totals row: transfer volume plus one context-appropriate movement figure. */}
            {hasRows && (
              <tr className="bg-muted/25 border-t border-border/40 text-xs select-none">
                <td className="px-4 py-3" colSpan={isSelecting ? 8 : 7}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {pageTotals.transfer > 0 ? (
                      <span className="inline-flex items-center gap-2 rounded-lg bg-blue-500/10 ring-1 ring-inset ring-blue-500/30 px-2.5 py-1.5 text-blue-500">
                        <ArrowRightLeft className="size-3.5 shrink-0" />
                        <span className="font-semibold">Transferred / Allocated</span>
                        <span className="font-extrabold">{formatSensitive(pageTotals.transfer)}</span>
                        <span className="text-xs font-medium text-blue-500">internal — excluded from debit &amp; credit</span>
                      </span>
                    ) : <span />}
                    <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-2">
                      {pageTotals.bucket && hasDistinctBucketMovement(pageTotals.bucketNet, net) ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-eyebrow uppercase text-muted-foreground">
                            {pageTotals.bucket} movement on this page
                          </span>
                          <span className={`font-extrabold text-sm ${pageTotals.bucketNet >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                            {pageTotals.bucketNet >= 0 ? '+' : '-'}{formatSensitive(Math.abs(pageTotals.bucketNet))}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-eyebrow uppercase text-muted-foreground">Net Position</span>
                          <span className={`font-extrabold text-sm ${net >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                            {net >= 0 ? '+' : '-'}{formatSensitive(Math.abs(net))}
                          </span>
                        </span>
                      )}
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {serverIsLoadingRows && Array.from({ length: loadingRowCount }).map((_, index) => (
              <tr key={`loading-${index}`} aria-hidden="true">
                {isSelecting && <td><Skeleton className="size-4 rounded" /></td>}
                <td><Skeleton className="h-3.5 w-20" /></td>
                <td><Skeleton className="h-3.5 w-40" /></td>
                <td><Skeleton className="h-3.5 w-24" /></td>
                <td><Skeleton className="h-5 w-24 rounded-full" /></td>
                <td className="text-right"><Skeleton className="ml-auto h-3.5 w-16" /></td>
                <td className="text-right"><Skeleton className="ml-auto h-3.5 w-16" /></td>
                <td><Skeleton className="mx-auto h-7 w-20 rounded-lg" /></td>
              </tr>
            ))}

            {!hasRows && !serverIsLoadingRows && (
              <tr className="list-row-enter">
                <td colSpan={isSelecting ? 8 : 7} className="p-8 text-center text-muted-foreground text-sm">
                  {serverIsFetching ? 'Loading…' : <LedgerEmptyState isFiltered={hasAnyFilter} onResetFilters={onResetFilters} onAddTransaction={onAddTransaction} />}
                </td>
              </tr>
            )}
      </DataTableBody>
    </DataTable>
  )
}
