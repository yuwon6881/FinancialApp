import React from 'react'
import { ChevronRight, FastForward, Link2, Pencil, Trash2 } from 'lucide-react'
import type { RecurringPayment, RecurringReminderSettings } from '../../types'
import type { BillCycleState } from '../../lib/billGroups'
import { hasBillingEnded, isEligibleForPayEarly, normalizeRecurringFrequency, RECURRING_PAYMENT_MODE_LABELS } from '../../lib/recurringPayments'
import { cn } from '../../lib/utils'
import { LedgerAllocationBadge } from '../ledger/LedgerAllocationBadge'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { CategoryIcon } from '../ui/CategoryIcon'
import { IconButton } from '../ui/IconButton'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { ToggleButton } from '../ui/ToggleButton'
import { formatOccurrenceDate, getOccurrenceStatusLabel, getRecurrenceDescription } from './formatters'
import { ReminderControls } from './ReminderControls'

export interface BillDetailProps {
  payment: RecurringPayment
  state: BillCycleState | null
  hideSensitive: boolean
  formatSensitive: (val: number) => React.ReactNode
  isPaymentSyncing: (id: string | number) => boolean
  isPaymentDeleting: (id: string | number) => boolean
  onToggleActive: (id: string) => void
  onDeletePayment: (id: string) => void
  onEditPayment: (payment: RecurringPayment) => void
  globalPushEnabled: boolean
  thisDevicePushEnabled?: boolean
  onUpdateReminder?: (id: string, settings: RecurringReminderSettings) => void
  onRequestPayEarly?: (id: string) => void
  onNavigateToLoan?: (loanId: string) => void
  /** The sheet on phones already titles itself with the bill's name. */
  showTitle?: boolean
}

const shortDate = (iso: string) => formatOccurrenceDate(iso, { month: 'short', day: 'numeric' })

/**
 * Everything about one bill, in the order it is wanted: what it costs, where it stands this cycle,
 * how it recurs, its reminder, then the things you can do with it. The side panel on desktop and
 * the sheet on phones both render this.
 */
export const BillDetail: React.FC<BillDetailProps> = ({
  payment: rp,
  state,
  hideSensitive,
  formatSensitive,
  isPaymentSyncing,
  isPaymentDeleting,
  onToggleActive,
  onDeletePayment,
  onEditPayment,
  globalPushEnabled,
  thisDevicePushEnabled,
  onUpdateReminder,
  onRequestPayEarly,
  onNavigateToLoan,
  showTitle = true,
}) => {
  const isBusy = isPaymentDeleting(rp.id) || isPaymentSyncing(rp.id) || rp.isPendingSync
  const isEnded = hasBillingEnded(rp)
  const isAnnual = normalizeRecurringFrequency(rp.frequency) === 'Annually'
  const occurrence = state?.occurrence ?? null

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <CategoryIcon category={rp.category} />
        <div className="min-w-0 flex-1">
          {showTitle && (
            <h2 className="flex min-w-0 flex-wrap items-center gap-1.5 text-subsection text-foreground">
              <span className="min-w-0 break-words">{rp.name}</span>
              {(!rp.active || isEnded) && <Badge tone="neutral">{isEnded ? 'Ended' : 'Paused'}</Badge>}
              <RowSyncStatus isDeleting={isPaymentDeleting(rp.id)} isSyncing={isPaymentSyncing(rp.id)} isPending={rp.isPendingSync} entityLabel="subscription" />
            </h2>
          )}
          <p className={cn('truncate text-label text-muted-foreground', showTitle && 'mt-0.5')}>{rp.category}</p>
        </div>
        <ToggleButton
          active={rp.active}
          onClick={() => onToggleActive(rp.id)}
          label={`${rp.active ? 'Pause' : 'Resume'} ${rp.name}`}
          disabled={isBusy || hideSensitive}
        />
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-1">
          <span className="text-title text-foreground tabular-nums">{formatSensitive(Math.abs(rp.amount))}</span>
          <span className="text-label text-muted-foreground">{isAnnual ? '/yr' : '/mo'}</span>
        </div>
        {rp.active && !isEnded && (
          <span className="text-caption text-muted-foreground tabular-nums">
            ≈ {formatSensitive(Math.abs(rp.amount) * (isAnnual ? 1 : 12) / 365)} / day
          </span>
        )}
      </div>

      {occurrence && (
        <section aria-label="This cycle" className="rounded-control bg-surface-2/70 p-3.5 dark:bg-surface-3/70">
          <div className="flex items-center justify-between gap-3">
            <span className="text-label text-muted-foreground">This cycle</span>
            <BillStatusChip status={occurrence.status} />
          </div>
          <dl className="mt-2 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-label">
            <dt className="text-muted-foreground">Due</dt>
            <dd className="min-w-0 text-right text-foreground tabular-nums">{shortDate(occurrence.dueDate)}</dd>
            {occurrence.status === 'PartiallyPaid' && (
              <>
                <dt className="text-muted-foreground">Paid so far</dt>
                <dd className="min-w-0 text-right text-foreground tabular-nums">{formatSensitive(occurrence.paidAmount ?? 0)}</dd>
                <dt className="text-muted-foreground">Still to pay</dt>
                <dd className="min-w-0 text-right font-semibold text-foreground tabular-nums">{formatSensitive(occurrence.remainingAmount ?? 0)}</dd>
              </>
            )}
            {occurrence.paidDate && (
              <>
                <dt className="text-muted-foreground">Paid on</dt>
                <dd className="min-w-0 text-right text-foreground tabular-nums">{shortDate(occurrence.paidDate.slice(0, 10))}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-label">
        <dt className="text-muted-foreground">Recurs</dt>
        <dd className="min-w-0 text-right text-foreground">{getRecurrenceDescription(normalizeRecurringFrequency(rp.frequency), rp.startDate, rp.dueDate)}</dd>
        {/* Stated for every bill because it is the reason Pay early is or isn't offered below --
            without it, an auto-deducted bill just looks like one missing a button. */}
        <dt className="text-muted-foreground">How it&rsquo;s paid</dt>
        <dd className="min-w-0 text-right text-foreground">{RECURRING_PAYMENT_MODE_LABELS[rp.paymentMode]}</dd>
        <dt className="text-muted-foreground">Bucket</dt>
        <dd className="min-w-0 text-right"><LedgerAllocationBadge ledgerCategory={rp.ledgerCategory} transactionId={rp.id} /></dd>
        <dt className="text-muted-foreground">Starts</dt>
        <dd className="min-w-0 text-right text-foreground tabular-nums">{rp.startDate}</dd>
        {rp.endDate && (
          <>
            <dt className="text-muted-foreground">Ends</dt>
            <dd className="min-w-0 text-right text-foreground tabular-nums">{rp.endDate}</dd>
          </>
        )}
      </dl>

      {rp.linkedLoanId && (
        <a
          href={`/recurring?loan=${encodeURIComponent(rp.linkedLoanId)}`}
          onClick={event => {
            if (!onNavigateToLoan || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            onNavigateToLoan(rp.linkedLoanId!)
          }}
          className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full bg-primary/8 px-3 text-label font-medium text-accent-ink transition hover:bg-primary/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:min-h-9"
          title={`View linked loan: ${rp.linkedLoanName || 'Loan'}`}
          aria-label={`View linked loan: ${rp.linkedLoanName || 'Loan'}`}
        >
          <Link2 className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Linked to {rp.linkedLoanName || 'Loan'}</span>
          <ChevronRight className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
        </a>
      )}

      <ReminderControls
        payment={rp}
        globalPushEnabled={globalPushEnabled}
        thisDevicePushEnabled={thisDevicePushEnabled}
        disabled={isBusy || hideSensitive || isEnded}
        isSyncing={isPaymentSyncing(rp.id)}
        onUpdateReminder={onUpdateReminder}
      />

      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        {isEligibleForPayEarly(rp) ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onRequestPayEarly?.(rp.id)}
            disabled={isBusy || hideSensitive}
            aria-label={`Pay Early for ${rp.name}`}
            title={hideSensitive ? 'Unhide balances to pay early' : 'Pay this subscription now'}
          >
            <FastForward className="size-3.5 shrink-0" aria-hidden="true" /> Pay early
          </Button>
        ) : <span />}
        <div className="flex items-center gap-0.5">
          <IconButton
            onClick={() => onEditPayment(rp)}
            disabled={isBusy || hideSensitive}
            label={`Edit ${rp.name}`}
            tooltip={hideSensitive ? 'Unhide balances to edit' : 'Edit subscription'}
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            onClick={() => { if (!hideSensitive) onDeletePayment(rp.id) }}
            disabled={isBusy || hideSensitive || Boolean(rp.linkedLoanId)}
            label={`Delete ${rp.name}`}
            tooltip={hideSensitive
              ? 'Unhide balances to edit'
              : rp.linkedLoanId
                ? `Linked to ${rp.linkedLoanName || 'a loan'} and cannot be deleted`
                : 'Delete subscription'}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </div>
  )
}

const STATUS_TONE: Record<string, string> = {
  Paid: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  SettledByLoanPayoff: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  PartiallyPaid: 'bg-primary/10 text-accent-ink',
  Discarded: 'bg-muted text-muted-foreground',
  Pending: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
}

export function BillStatusChip({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-caption font-medium', STATUS_TONE[status] ?? STATUS_TONE.Pending, className)}>
      {getOccurrenceStatusLabel(status)}
    </span>
  )
}
