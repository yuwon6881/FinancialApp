import { DataTable, DataTableBody, DataTableHeader, DataTableHeaderCell } from '../ui/DataTable'
import { DesktopLedgerRow } from './LedgerRows'
import type { LedgerListProps } from './ledgerListShared'
import { LedgerEmptyState } from './LedgerEmptyState'
import { LedgerPageTotals } from './LedgerPageTotals'
import { Skeleton } from '../ui/Skeleton'

// The dense (>= 1280px) ledger: one quiet table with a single signed Amount column, followed by
// the page totals. Mounted only in the dense tier, so a phone never builds these rows. Rows
// themselves are memoized in LedgerRows.
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
}: LedgerListProps) {
  const hasRows = transactions.length > 0
  const columnCount = isSelecting ? 7 : 6
  return (
    <div className="space-y-3">
      <DataTable>
        <DataTableHeader>
          {isSelecting && <DataTableHeaderCell className="w-12"><span className="sr-only">Select</span></DataTableHeaderCell>}
          <DataTableHeaderCell className="w-24">Date</DataTableHeaderCell>
          <DataTableHeaderCell>Description</DataTableHeaderCell>
          <DataTableHeaderCell>Category</DataTableHeaderCell>
          <DataTableHeaderCell>Bucket</DataTableHeaderCell>
          <DataTableHeaderCell className="text-right">Amount</DataTableHeaderCell>
          <DataTableHeaderCell className="w-px"><span className="sr-only">Actions</span></DataTableHeaderCell>
        </DataTableHeader>
        {/* The entrance is CSS (see .list-container-enter / .list-row-enter in index.css); `key`
            still remounts the body so a cycle/page change replays it. */}
        <DataTableBody key={listKey} className="list-container-enter">
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

          {serverIsLoadingRows && Array.from({ length: loadingRowCount }).map((_, index) => (
            <tr key={`loading-${index}`} aria-hidden="true">
              {isSelecting && <td><Skeleton className="size-4 rounded" /></td>}
              <td><Skeleton className="h-3.5 w-14" /></td>
              <td><div className="flex items-center gap-3"><Skeleton className="size-8 rounded-[0.625rem]" /><Skeleton className="h-3.5 w-40" /></div></td>
              <td><Skeleton className="h-3.5 w-20" /></td>
              <td><Skeleton className="h-3.5 w-20" /></td>
              <td className="text-right"><Skeleton className="ml-auto h-3.5 w-20" /></td>
              <td><Skeleton className="ml-auto h-7 w-24 rounded-full" /></td>
            </tr>
          ))}

          {!hasRows && !serverIsLoadingRows && (
            <tr className="list-row-enter">
              <td colSpan={columnCount} className="text-center text-body text-muted-foreground">
                {serverIsFetching ? <p className="p-8">Loading…</p> : <LedgerEmptyState isFiltered={hasAnyFilter} onResetFilters={onResetFilters} onAddTransaction={onAddTransaction} />}
              </td>
            </tr>
          )}
        </DataTableBody>
      </DataTable>
      {hasRows && (
        <LedgerPageTotals
          count={transactions.length}
          totals={pageTotals}
          currency={currency}
          masked={maskFinancialFigures ?? hideSensitive}
        />
      )}
    </div>
  )
}
