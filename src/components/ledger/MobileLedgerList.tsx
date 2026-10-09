import type { Transaction } from '../../types'
import { AmountText } from '../ui/AmountText'
import { Skeleton } from '../ui/Skeleton'
import { MobileLedgerRow } from './LedgerRows'
import type { LedgerListProps } from './ledgerListShared'
import { LedgerEmptyState } from './LedgerEmptyState'
import { LedgerPageTotals } from './LedgerPageTotals'

interface DayGroup {
  date: string
  rows: Array<{ transaction: Transaction; index: number }>
}

/** Consecutive rows sharing a date; the list arrives already sorted, so one pass is enough. */
function groupByDay(transactions: Transaction[]): DayGroup[] {
  const groups: DayGroup[] = []
  transactions.forEach((transaction, index) => {
    const date = transaction.date.slice(0, 10)
    const last = groups[groups.length - 1]
    if (last && last.date === date) last.rows.push({ transaction, index })
    else groups.push({ date, rows: [{ transaction, index }] })
  })
  return groups
}

function dayLabel(date: string, today = new Date()): string {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  const value = new Date(year, month - 1, day)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diff = Math.round((startOfToday.getTime() - value.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return value.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(year !== today.getFullYear() ? { year: 'numeric' } : {}),
  })
}

const isTransfer = (transaction: Transaction) =>
  transaction.ledgerCategory.startsWith('Transfer:') || transaction.ledgerCategory.toLowerCase() === 'accountmove'

// The compact and medium ledger: one grouped card per day, each row swipeable on touch to reveal
// Edit / Move / Delete. Mounted below the dense tier only, so the desktop table's row tree is never
// built alongside it.
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
  groupByDay: grouped = true,
}: LedgerListProps) {
  const hasRows = transactions.length > 0
  const masked = maskFinancialFigures ?? hideSensitive
  const groups: DayGroup[] = grouped
    ? groupByDay(transactions)
    : [{ date: '', rows: transactions.map((transaction, index) => ({ transaction, index })) }]

  const renderRow = ({ transaction, index }: DayGroup['rows'][number]) => (
    <MobileLedgerRow
      key={transaction.id}
      transaction={transaction}
      accounts={accounts}
      index={index}
      hint={index === 0}
      isDeleting={isTxDeleting(transaction.id)}
      isSyncing={isTxSyncing(transaction.id)}
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
  )

  return (
    // Entrance is CSS (.list-container-enter / .list-row-enter); `key` still remounts the list so a
    // cycle/page change replays it.
    <div key={listKey} className="list-container-enter w-full space-y-5">
      {hasRows && groups.map(group => {
        const dayNet = group.rows.reduce((sum, { transaction }) => (isTransfer(transaction) ? sum : sum + transaction.amount), 0)
        return (
          <section key={group.date || 'all'} aria-label={group.date ? dayLabel(group.date) : 'Transactions'}>
            {group.date && (
              <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                <h3 className="text-label font-semibold text-foreground">{dayLabel(group.date)}</h3>
                <AmountText value={dayNet} currency={currency} isMasked={masked} signDisplay="always" tone="muted" className="text-caption" />
              </div>
            )}
            <div className="divide-y divide-border/60 overflow-hidden rounded-panel border border-border/70 bg-card">
              {group.rows.map(renderRow)}
            </div>
          </section>
        )
      })}

      {hasRows && <LedgerPageTotals count={transactions.length} totals={pageTotals} currency={currency} masked={masked} />}

      {serverIsLoadingRows && (
        <div aria-hidden="true" className="divide-y divide-border/60 overflow-hidden rounded-panel border border-border/70 bg-card">
          {Array.from({ length: loadingRowCount }).map((_, index) => (
            <div key={`loading-${index}`} className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-24" /></div>
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      )}

      {!hasRows && !serverIsLoadingRows && (
        <div className="list-row-enter rounded-panel border border-border/70 bg-card">
          {serverIsFetching
            ? <p className="p-8 text-center text-body text-muted-foreground">Loading…</p>
            : <LedgerEmptyState isFiltered={hasAnyFilter} onResetFilters={onResetFilters} onAddTransaction={onAddTransaction} />}
        </div>
      )}
    </div>
  )
}
