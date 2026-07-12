import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { listContainerVariants } from '../../lib/animations'
import type { Transaction } from '../../types'
import { DesktopLedgerRow, MobileLedgerRow } from './LedgerRows'

interface LedgerTransactionListProps {
  transactions: Transaction[]
  // Remount key so a cycle/page/mode change replays the list entrance animation.
  listKey: string
  hideSensitive: boolean
  currency: string
  serverIsFetching: boolean
  pageTotals: { inflow: number; outflow: number }
  isTxDeleting: (id: string) => boolean
  isTxSyncing: (id: string) => boolean
  onStartEdit: (t: Transaction) => void
  onDeleteClick: (t: Transaction) => void
  onSplitEditBlocked: () => void
  formatSensitive: (val: number) => ReactNode
}

// Desktop table + mobile card list for the ledger, including the page-total
// summary row and the empty/loading state. Rows themselves are memoized in
// LedgerRows; this owns the layout and totals.
export function LedgerTransactionList({
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
}: LedgerTransactionListProps) {
  const hasRows = transactions.length > 0
  return (
    <>
      {/* Ledger Table - Desktop */}
      <div className="hidden md:block overflow-hidden border border-border/60 rounded-2xl bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20 text-xs font-semibold text-muted-foreground select-none">
                <th className="p-4">Date</th>
                <th className="p-4">Description</th>
                <th className="p-4">Category</th>
                <th className="p-4">Ledger Category</th>
                <th className="p-4 text-right text-orange-500/90 font-bold">Debit (Outflow)</th>
                <th className="p-4 text-right text-emerald-500/90 font-bold">Credit (Inflow)</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <motion.tbody
              key={listKey}
              initial="hidden" animate="show"
              variants={listContainerVariants}
              className="divide-y divide-border/30 text-xs"
            >
              <AnimatePresence>
              {transactions.map(t => (
                <DesktopLedgerRow
                  key={t.id}
                  transaction={t}
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
                <tr className="bg-muted/25 font-bold border-t-2 border-border text-xs select-none">
                  <td className="p-4 uppercase tracking-wider text-foreground font-extrabold" colSpan={4}>
                    Page Total <span className="text-muted-foreground font-bold normal-case tracking-normal">({transactions.length} items)</span>
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
              </AnimatePresence>

              {!hasRows && (
                <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                    {serverIsFetching ? 'Loading...' : 'No transactions match your search or filter criteria.'}
                  </td>
                </motion.tr>
              )}
            </motion.tbody>
          </table>
        </div>
      </div>

      {/* Ledger List - Mobile (swipe a row left to reveal Edit / Delete) */}
      <motion.div
        key={listKey}
        initial="hidden" animate="show"
        variants={listContainerVariants}
        className="block md:hidden space-y-3"
      >
        <AnimatePresence>
        {transactions.map((t, idx) => (
          <MobileLedgerRow
            key={t.id}
            transaction={t}
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
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Page Total Summary</div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-semibold">Total Outflow (Debit)</span>
              <span className="text-orange-500 font-bold text-sm">{formatSensitive(pageTotals.outflow)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-border/30 pt-2.5">
              <span className="text-muted-foreground font-semibold">Total Inflow (Credit)</span>
              <span className="text-emerald-500 font-bold text-sm">{formatSensitive(pageTotals.inflow)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-border/50 pt-2.5 font-bold">
              <span className="text-foreground">Net Position</span>
              <span className={`${pageTotals.inflow - pageTotals.outflow >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                {pageTotals.inflow - pageTotals.outflow >= 0 ? '+' : '-'}
                {formatSensitive(Math.abs(pageTotals.inflow - pageTotals.outflow))}
              </span>
            </div>
          </div>
        )}
        </AnimatePresence>

        {!hasRows && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 text-center text-muted-foreground text-sm border rounded-xl bg-card">
            {serverIsFetching ? 'Loading...' : 'No transactions match your criteria.'}
          </motion.div>
        )}
      </motion.div>
    </>
  )
}
