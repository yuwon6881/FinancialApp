import React from 'react'
import { ChevronRight, Repeat, X } from 'lucide-react'
import type { ActiveRecurringPayment, RecurringPayment, RecurringReminderSettings } from '../../types'
import { describeBillDue, getBillCycleState, groupBills, type BillCycleState } from '../../lib/billGroups'
import { useIsDenseContent } from '../../lib/breakpoints'
import { getCategoryDotClass } from '../../lib/categoryColors'
import { normalizeRecurringFrequency } from '../../lib/recurringPayments'
import { cn } from '../../lib/utils'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { CategoryIcon } from '../ui/CategoryIcon'
import { panelClass } from '../ui/panelStyles'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { useHighlightedElement } from '../ui/useHighlightedElement'
import { BillDetail, BillStatusChip } from './BillDetail'
import { formatOccurrenceDate } from './formatters'

interface RecurringBillsProps {
  payments: RecurringPayment[]
  /** This cycle's occurrences with their paid state, from the bill timeline model. */
  occurrences: ActiveRecurringPayment[]
  totalCount: number
  /** A day picked on the day strip (yyyy-MM-dd): only the bills due that day are listed. */
  dayFilter?: string | null
  onClearDayFilter?: () => void
  hideSensitive: boolean
  formatSensitive: (val: number) => React.ReactNode
  isPaymentSyncing: (id: string | number) => boolean
  isPaymentDeleting: (id: string | number) => boolean
  onToggleActive: (id: string) => void
  onDeletePayment: (id: string) => void
  onEditPayment: (payment: RecurringPayment) => void
  highlightedId?: string | null
  onClearHighlight?: () => void
  globalPushEnabled: boolean
  thisDevicePushEnabled?: boolean
  onUpdateReminder?: (id: string, settings: RecurringReminderSettings) => void
  onRequestPayEarly?: (id: string) => void
  onNavigateToLoan?: (loanId: string) => void
}

interface BillRow {
  payment: RecurringPayment
  state: BillCycleState
}

// The year is only worth its space when it is not this one.
const shortDate = (iso: string) => formatOccurrenceDate(iso, iso.slice(0, 4) === String(new Date().getFullYear())
  ? { month: 'short', day: 'numeric' }
  : { month: 'short', day: 'numeric', year: 'numeric' })

/**
 * Bills as one list, grouped by what needs doing: overdue first, then due this week, later, paid
 * and paused. Picking a bill opens its detail beside the list on wide screens and in a sheet below that.
 */
export const RecurringBills: React.FC<RecurringBillsProps> = ({
  payments,
  occurrences,
  totalCount,
  dayFilter = null,
  onClearDayFilter,
  highlightedId = null,
  onClearHighlight,
  ...detailProps
}) => {
  // The detail sits beside the list only once there is room for both: below 1280px the list would
  // be squeezed to truncated names, so the detail opens as a sheet instead.
  const isWide = useIsDenseContent()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const rows = React.useMemo<BillRow[]>(
    () => payments.map(payment => ({ payment, state: getBillCycleState(payment, occurrences) })),
    [payments, occurrences],
  )
  const visibleRows = React.useMemo(() => {
    if (!dayFilter) return rows
    const dueThatDay = new Set(occurrences.filter(occurrence => occurrence.dueDate === dayFilter).map(occurrence => occurrence.recurringPaymentId))
    return rows.filter(row => dueThatDay.has(row.payment.id))
  }, [dayFilter, occurrences, rows])
  const groups = React.useMemo(() => groupBills(visibleRows), [visibleRows])
  const orderedRows = groups.flatMap(group => group.rows)

  // Desktop always has a bill open beside the list, so the panel is never an empty box.
  const effectiveId = isWide
    ? (orderedRows.some(row => row.payment.id === selectedId) ? selectedId : orderedRows[0]?.payment.id ?? null)
    : selectedId
  const selectedRow = rows.find(row => row.payment.id === effectiveId) ?? null

  // A search result lands on its bill: opened beside the list on desktop, ringed in place on phones
  // (a sheet popping up unasked would hide the very row being pointed at).
  React.useEffect(() => {
    if (highlightedId && isWide) setSelectedId(highlightedId)
  }, [highlightedId, isWide])
  useHighlightedElement(highlightedId ? `recur-card-${highlightedId}` : null, onClearHighlight)

  const filterDayLabel = dayFilter ? shortDate(dayFilter) : null

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
      <div className="min-w-0 space-y-5">
        {filterDayLabel && (
          <div className="flex items-center justify-between gap-3 rounded-control bg-primary/8 py-1 pl-3.5 pr-1 text-label text-foreground">
            <span>Bills due {filterDayLabel}</span>
            <Button variant="tertiary" size="sm" onClick={onClearDayFilter} className="gap-1 text-accent-ink">
              <X className="size-3.5" aria-hidden="true" /> Show all
            </Button>
          </div>
        )}

        {groups.map(group => (
          <section key={group.id} aria-labelledby={`bill-group-${group.id}`} className="space-y-2">
            <h2 id={`bill-group-${group.id}`} className="flex items-baseline gap-2 px-1 text-label font-medium text-muted-foreground">
              <span className={cn(group.id === 'overdue' && 'text-red-600 dark:text-red-400')}>{group.label}</span>
              <span className="tabular-nums text-muted-foreground/80">{group.rows.length}</span>
            </h2>
            <ul className={cn(panelClass, 'divide-y divide-border/60 overflow-hidden p-0')}>
              {group.rows.map(row => (
                <BillListRow
                  key={row.payment.id}
                  row={row}
                  selected={row.payment.id === effectiveId}
                  showSelection={isWide}
                  formatSensitive={detailProps.formatSensitive}
                  isSyncing={detailProps.isPaymentSyncing(row.payment.id)}
                  isDeleting={detailProps.isPaymentDeleting(row.payment.id)}
                  onSelect={() => setSelectedId(row.payment.id)}
                />
              ))}
            </ul>
          </section>
        ))}

        {visibleRows.length === 0 && (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-28 items-center gap-3 rounded-panel bg-surface-2/70 p-4 text-left text-body text-muted-foreground sm:min-h-36 sm:flex-col sm:justify-center sm:gap-3 sm:p-12 sm:text-center"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-muted-foreground">
              <Repeat className="size-5" aria-hidden="true" />
            </span>
            <p className="min-w-0 max-w-md leading-relaxed">
              {totalCount > 0
                ? 'No subscriptions match your filter criteria.'
                : 'Add a recurring bill, loan, or subscription above to track it here.'}
            </p>
          </div>
        )}
      </div>

      {isWide && selectedRow && (
        <aside aria-label={`${selectedRow.payment.name} details`} className={cn(panelClass, 'sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain p-5')}>
          <BillDetail payment={selectedRow.payment} state={selectedRow.state} {...detailProps} />
        </aside>
      )}

      {!isWide && (
        <BottomSheet
          isOpen={Boolean(selectedRow)}
          onClose={() => setSelectedId(null)}
          title={selectedRow?.payment.name ?? ''}
          maxWidthClassName="max-w-lg"
        >
          {selectedRow && (
            <BillDetail payment={selectedRow.payment} state={selectedRow.state} showTitle={false} {...detailProps} />
          )}
        </BottomSheet>
      )}
    </div>
  )
}

function BillListRow({
  row,
  selected,
  showSelection,
  formatSensitive,
  isSyncing,
  isDeleting,
  onSelect,
}: {
  row: BillRow
  selected: boolean
  showSelection: boolean
  formatSensitive: (val: number) => React.ReactNode
  isSyncing: boolean
  isDeleting: boolean
  onSelect: () => void
}) {
  const { payment: rp, state } = row
  const isAnnual = normalizeRecurringFrequency(rp.frequency) === 'Annually'
  const dueLabel = describeBillDue(state, shortDate)
  const dueTone = state.group === 'overdue'
    ? 'text-red-600 dark:text-red-400'
    : state.group === 'due-soon' && (state.daysAway ?? 99) <= 1
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-muted-foreground'
  const partPaid = state.occurrence?.status === 'PartiallyPaid'

  return (
    <li
      id={`recur-card-${rp.id}`}
      className={cn(
        'relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60',
        showSelection && selected && 'bg-surface-2 hover:bg-surface-2',
      )}
    >
      {/* The whole row is the button; the text sits over it but lets clicks through. */}
      <Button
        variant="tertiary"
        onClick={onSelect}
        aria-label={`Show details for ${rp.name}`}
        aria-current={showSelection && selected ? 'true' : undefined}
        className="absolute inset-0 z-0 h-full min-h-0 w-full rounded-none p-0 hover:bg-transparent focus-visible:-outline-offset-2 lg:min-h-0"
      />
      {showSelection && selected && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-foreground" />}
      <span className={cn('pointer-events-none relative', state.group === 'paused' && 'opacity-60')}>
        <CategoryIcon category={rp.category} size="sm" />
      </span>
      <div className={cn('pointer-events-none relative min-w-0 flex-1', state.group === 'paused' && 'opacity-60')}>
        <h3 className="flex min-w-0 items-center gap-1.5 text-body font-medium text-foreground">
          <span className="truncate">{rp.name}</span>
          <RowSyncStatus isDeleting={isDeleting} isSyncing={isSyncing} isPending={rp.isPendingSync} entityLabel="subscription" />
        </h3>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption">
          <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', getCategoryDotClass(rp.ledgerCategory))} />
          <span className={cn('shrink-0', dueTone)}>{dueLabel}</span>
          <span className="min-w-0 truncate text-muted-foreground">· {rp.ledgerCategory}</span>
        </p>
      </div>
      <div className="pointer-events-none relative flex shrink-0 flex-col items-end gap-0.5">
        <span className={cn('text-body font-semibold text-foreground tabular-nums', state.group === 'paused' && 'text-muted-foreground')}>
          {formatSensitive(Math.abs(rp.amount))}
          <span className="ml-0.5 text-caption font-normal text-muted-foreground">{isAnnual ? '/yr' : '/mo'}</span>
        </span>
        {partPaid && <BillStatusChip status="PartiallyPaid" />}
      </div>
      {!showSelection && <ChevronRight className="pointer-events-none relative size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
    </li>
  )
}
