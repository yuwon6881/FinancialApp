import { ArrowRightLeft } from 'lucide-react'
import { DataTable, DataTableBody, DataTableHeader, DataTableHeaderCell } from '../ui/DataTable'
import { DesktopLedgerRow } from './LedgerRows'
import type { LedgerListProps } from './ledgerListShared'

// Desktop (>= md) ledger table, including the page-total summary rows and the
// empty/loading state. Mounted only when useIsMobile() is false, so a phone never
// builds these 7-cell rows. Rows themselves are memoized in LedgerRows.
export function DesktopLedgerTable({
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
  onEditBlocked,
  formatSensitive,
}: LedgerListProps) {
  const hasRows = transactions.length > 0
  const net = pageTotals.inflow - pageTotals.outflow
  return (
    <DataTable>
      <DataTableHeader>
        <DataTableHeaderCell>Date</DataTableHeaderCell>
        <DataTableHeaderCell>Description</DataTableHeaderCell>
        <DataTableHeaderCell>Category</DataTableHeaderCell>
        <DataTableHeaderCell>Ledger Allocation</DataTableHeaderCell>
        <DataTableHeaderCell className="text-right text-orange-500/90 font-bold">Debit (Outflow)</DataTableHeaderCell>
        <DataTableHeaderCell className="text-right text-emerald-500/90 font-bold">Credit (Inflow)</DataTableHeaderCell>
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
                isDeleting={isTxDeleting(t.id)}
                isSyncing={isTxSyncing(t.id)}
                hideSensitive={hideSensitive}
                currency={currency}
                onStartEdit={onStartEdit}
                onDeleteClick={onDeleteClick}
                onEditBlocked={onEditBlocked}
              />
            ))}
            {hasRows && (
              <tr className="bg-muted/25 font-bold border-t-2 border-border text-xs select-none">
                <td className="p-4 align-middle" colSpan={4}>
                  <span className="uppercase tracking-wider text-foreground font-extrabold">
                    Page Total <span className="text-muted-foreground font-bold normal-case tracking-normal">({transactions.length} items)</span>
                  </span>
                </td>
                {/* Wrapped in the same pill shape as the row values so the totals line up exactly
                    under each column (plain text sat ~0.6rem further right than the pill text),
                    with a ring + stronger fill to read clearly as the column total. */}
                <td className="p-4 text-right">
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-orange-500/15 ring-1 ring-inset ring-orange-500/40 text-orange-500 font-extrabold text-xs">
                    {formatSensitive(pageTotals.outflow)}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/40 text-emerald-500 font-extrabold text-xs">
                    {formatSensitive(pageTotals.inflow)}
                  </span>
                </td>
                <td className="p-4"></td>
              </tr>
            )}
            {/* Secondary totals row: the transfer figure as a clearly labelled chip
                (rather than a stray sentence), plus the page Net Position. */}
            {hasRows && (
              <tr className="bg-muted/25 border-t border-border/40 text-xs select-none">
                <td className="px-4 py-3" colSpan={7}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {pageTotals.transfer > 0 ? (
                      <span className="inline-flex items-center gap-2 rounded-lg bg-blue-500/10 ring-1 ring-inset ring-blue-500/30 px-2.5 py-1.5 text-blue-500">
                        <ArrowRightLeft className="size-3.5 shrink-0" />
                        <span className="font-semibold">Transferred / Allocated</span>
                        <span className="font-extrabold">{formatSensitive(pageTotals.transfer)}</span>
                        <span className="text-[10px] font-medium text-blue-500/70">internal — excluded from debit &amp; credit</span>
                      </span>
                    ) : <span />}
                    <span className="inline-flex items-center gap-2">
                      <span className="uppercase tracking-wider text-muted-foreground font-bold text-[11px]">Net Position</span>
                      <span className={`font-extrabold text-sm ${net >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                        {net >= 0 ? '+' : '-'}{formatSensitive(Math.abs(net))}
                      </span>
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {!hasRows && (
              <tr className="list-row-enter">
                <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                  {serverIsFetching ? 'Loading…' : 'No transactions match your search or filter criteria.'}
                </td>
              </tr>
            )}
      </DataTableBody>
    </DataTable>
  )
}
