import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchLoanSchedule } from '../../../lib/api/loans'
import { entryRateFromAnnual, formatRatePercent, loanPayoffProgress } from '../../../lib/loanTerms'
import type { Loan, LoanScheduleEntry } from '../../../types'
import { Button } from '../../ui/Button'
import { AskAiButton } from '../../ui/AskAiButton'
import { AlertBanner } from '../../ui/AlertBanner'
import { ProgressRing } from '../../ui/ProgressRing'
import { cn } from '../../../lib/utils'
import { panelClass } from '../../ui/panelStyles'
import { RowSyncStatus } from '../../ui/RowSyncBadge'
import { formatOccurrenceDate } from '../formatters'
import { LoanCardDetails } from './LoanCardDetails'
import { IconButton } from '../../ui/IconButton'
import { Tabs } from '../../ui/Tabs'

interface LoanCardProps {
  loan: Loan
  hideSensitive: boolean
  formatSensitive: (value: number) => ReactNode
  isSyncing: boolean
  onEdit: () => void
  onDelete: () => void
  onExplain: () => void
  onRepay?: () => void
  onUndoSettlement?: () => void
}

export function LoanCard({
  loan,
  hideSensitive,
  formatSensitive,
  isSyncing,
  onEdit,
  onDelete,
  onExplain,
  onRepay,
  onUndoSettlement,
}: LoanCardProps) {
  const scheduleUnavailable = loan.isRecalculating === true || loan.scheduleStatus === 'Incomplete' || !loan.scheduleFrequency || !loan.scheduleDueDay || !loan.scheduleStartDate
  const payoffProgress = loanPayoffProgress(loan, scheduleUnavailable)
  const next = loan.snapshot.nextPayment
  const rateBasis = loan.rateBasis ?? 'Yearly'
  const rateText = rateBasis === 'Monthly'
    ? `${formatRatePercent(entryRateFromAnnual(loan.annualRatePercent, rateBasis))} a month (${formatRatePercent(loan.annualRatePercent)} a year)`
    : `${formatRatePercent(loan.annualRatePercent)} a year`
  const interestOnlyBalanceRemains = loan.interestMethod === 'InterestOnly' && loan.snapshot.outstandingBalance > 0
  const finalBalanceDueNow = interestOnlyBalanceRemains && next === null
  const actualRows = loan.snapshot.payments.map(payment => ({ ...payment, kind: 'Paid' as const }))
  const replayRevision = JSON.stringify([loan.snapshot.payments, loan.snapshot.futureSchedule, loan.snapshot.nextPayment])
  const scheduleKey = useMemo(() => [
    loan.id,
    loan.recurringPaymentId,
    loan.trackingStartDate,
    loan.openingPrincipal,
    loan.annualRatePercent,
    loan.termPeriods,
    loan.interestMethod,
    loan.scheduleFrequency,
    loan.scheduleDueDay,
    loan.scheduleStartDate,
    loan.scheduleStatus,
    loan.snapshot.outstandingBalance,
    loan.snapshot.lastOccurrenceDate,
    loan.snapshot.payments.length,
    replayRevision,
  ].join('|'), [
    loan.annualRatePercent,
    loan.id,
    loan.interestMethod,
    loan.openingPrincipal,
    loan.recurringPaymentId,
    loan.scheduleDueDay,
    loan.scheduleFrequency,
    loan.scheduleStartDate,
    loan.scheduleStatus,
    loan.trackingStartDate,
    loan.snapshot.lastOccurrenceDate,
    loan.snapshot.outstandingBalance,
    loan.snapshot.payments.length,
    replayRevision,
    loan.termPeriods,
  ])
  const [section, setSection] = useState<LoanSection>('details')
  const isScheduleOpen = section === 'schedule'
  const [loadedSchedule, setLoadedSchedule] = useState<{ key: string; rows: LoanScheduleEntry[] } | null>(null)
  const [scheduleLoadingKey, setScheduleLoadingKey] = useState<string | null>(null)
  const [scheduleErrorKey, setScheduleErrorKey] = useState<string | null>(null)
  const loadSchedule = useCallback(async () => {
    if (loan.isPendingSync || scheduleUnavailable) return
    const key = scheduleKey
    setScheduleLoadingKey(key)
    setScheduleErrorKey(null)
    try {
      const rows = await fetchLoanSchedule(loan.id)
      setLoadedSchedule({ key, rows })
    } catch {
      setScheduleErrorKey(key)
    } finally {
      setScheduleLoadingKey(current => current === key ? null : current)
    }
  }, [loan.id, loan.isPendingSync, scheduleKey, scheduleUnavailable])

  const handleSectionChange = useCallback((next: LoanSection) => {
    const needsFullSchedule = next === 'schedule'
      && !loan.isPendingSync
      && !scheduleUnavailable
      && loadedSchedule?.key !== scheduleKey
      && scheduleLoadingKey !== scheduleKey
    if (needsFullSchedule) {
      // Commit the tab and the loading state together, so the short preview schedule carried on
      // the snapshot can never paint for a frame before the full one starts loading.
      setScheduleLoadingKey(scheduleKey)
      setScheduleErrorKey(null)
      void loadSchedule()
    }
    setSection(next)
  }, [loadSchedule, loadedSchedule?.key, loan.isPendingSync, scheduleKey, scheduleLoadingKey, scheduleUnavailable])

  useEffect(() => {
    if (!isScheduleOpen || loan.isPendingSync || scheduleUnavailable || loadedSchedule?.key === scheduleKey || scheduleLoadingKey === scheduleKey) return
    void loadSchedule()
  }, [isScheduleOpen, loadSchedule, loadedSchedule?.key, loan.isPendingSync, scheduleKey, scheduleLoadingKey, scheduleUnavailable])

  const scheduleRows = (loadedSchedule?.key === scheduleKey ? loadedSchedule.rows : loan.snapshot.futureSchedule)
    .map(payment => ({ ...payment, kind: 'Planned' as const }))
  const canRepay = loan.snapshot.outstandingBalance > 0 && !scheduleUnavailable && Boolean(onRepay)
  const actionsDisabled = hideSensitive || loan.isPendingSync || loan.isRecalculating
  const payoffLine = interestOnlyBalanceRemains
    ? 'No automatic payoff'
    : loan.snapshot.payoffDate
      ? `Paid off by ${formatOccurrenceDate(loan.snapshot.payoffDate, { month: 'short', year: 'numeric' })}`
      : null
  const panelId = `loan-${loan.id}-panel`

  return (
    <article id={`loan-card-${loan.id}`} className={cn(panelClass, 'w-full min-w-0 p-4 sm:p-5')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-subsection text-foreground">{loan.name}</h3>
            <RowSyncStatus
              entityLabel="loan"
              isDeleting={loan.isPendingDelete === true}
              isSyncing={isSyncing}
              isPending={loan.isPendingSync === true}
            />
          </div>
          <p className="mt-0.5 truncate text-label text-muted-foreground">
            {loan.recurringPaymentExists
              ? `Linked bill: ${loan.recurringPaymentName || 'Recurring bill'}`
              : 'Bill removed · original history preserved'}
          </p>
        </div>
        <div className="-mr-2 -mt-1 flex shrink-0 items-center">
          <IconButton
            label={`Edit ${loan.name}`}
            tooltip={hideSensitive ? 'Unhide balances to edit' : 'Edit loan'}
            onClick={onEdit}
            disabled={hideSensitive}
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            label={`Delete ${loan.name}`}
            tooltip={hideSensitive ? 'Unhide balances to delete' : 'Delete loan'}
            onClick={onDelete}
            disabled={hideSensitive}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {loan.isRecalculating ? (
        <AlertBanner variant="warning" className="mt-4">
          Recalculating from {loan.recurringPaymentName || 'the selected bill'} history. Forecasts will return after sync.
        </AlertBanner>
      ) : scheduleUnavailable ? (
        <AlertBanner variant="warning" className="mt-4">
          This loan cannot show a balance or schedule because its bill history is incomplete. Edit this loan to choose a valid bill.
        </AlertBanner>
      ) : (
        <div className="mt-4 flex items-center gap-4 sm:gap-5">
          {/* Anchored on the principal at the tracking start date, so the copy says "tracked" and
              never "borrowed": a loan added part-way through its life has no record of what came
              before it. Absent entirely when the figure is not knowable. */}
          {payoffProgress && (
            <ProgressRing
              percent={payoffProgress.percentPaid}
              size={84}
              thickness={8}
              label={`${payoffProgress.percentPaid.toFixed(0)}% of the tracked principal cleared`}
            >
              <span className="text-callout font-semibold tabular-nums text-foreground">{payoffProgress.percentPaid.toFixed(0)}%</span>
            </ProgressRing>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-label text-muted-foreground">Still owed</p>
            <p className="text-title text-foreground tabular-nums">
              {formatSensitive(loan.snapshot.outstandingBalance)}
            </p>
            {payoffLine && <p className="mt-0.5 text-label text-muted-foreground">{payoffLine}</p>}
            {payoffProgress && (
              <p className="mt-0.5 text-caption text-muted-foreground tabular-nums">
                {formatSensitive(payoffProgress.clearedPrincipal)} cleared of {formatSensitive(payoffProgress.trackedPrincipal)} tracked
              </p>
            )}
          </div>
        </div>
      )}

      {!loan.isRecalculating && !scheduleUnavailable && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-control bg-surface-2/70 px-3.5 py-3 text-label dark:bg-surface-3/70">
          <span className="min-w-0 text-muted-foreground">Next instalment</span>
          <span className="shrink-0 text-body font-semibold text-foreground tabular-nums">
            {finalBalanceDueNow ? 'Final balance due now' : formatSensitive(loan.snapshot.scheduledPayment)}
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canRepay && (
          <Button
            variant="primary"
            size="sm"
            type="button"
            aria-label={`Make a payment for ${loan.name}`}
            title={hideSensitive ? 'Unhide balances to repay' : 'Pay instalments in advance or record full settlement'}
            onClick={onRepay}
            disabled={actionsDisabled}
          >
            <span>Make payment</span>
          </Button>
        )}
        <AskAiButton
          collapse="full"
          label="Explain this loan"
          ariaLabel={`Explain ${loan.name} with Ask AI`}
          title={hideSensitive ? 'Unhide balances to explain this loan' : 'Explain this loan with Ask AI'}
          onClick={onExplain}
          disabled={actionsDisabled}
        />
        {loan.settlementActionId && onUndoSettlement && (
          <Button
            variant="secondary"
            size="sm"
            type="button"
            aria-label={`Undo the full settlement of ${loan.name}`}
            title={hideSensitive ? 'Unhide balances to undo this settlement' : 'Reopen this loan and restore its recurring bill'}
            onClick={onUndoSettlement}
            disabled={actionsDisabled}
          >
            <span>Undo settlement</span>
          </Button>
        )}
      </div>

      <div className="mt-5 border-t border-border/60 pt-4">
        <Tabs
          variant="segmented"
          label={`${loan.name} sections`}
          idPrefix={`loan-${loan.id}`}
          value={section}
          onValueChange={handleSectionChange}
          className="w-full [&>*]:flex-1 [&>*]:justify-center"
          options={[
            { value: 'details', label: 'Details', panelId },
            { value: 'schedule', label: 'Schedule', panelId },
            { value: 'history', label: 'History', count: actualRows.length, panelId },
          ]}
        />
        <div id={panelId} role="tabpanel" aria-labelledby={`loan-${loan.id}-${section}`} className="mt-3 min-w-0">
          {section === 'details' && (
            <LoanCardDetails
              loan={loan}
              hideSensitive={hideSensitive}
              formatSensitive={formatSensitive}
              scheduleUnavailable={scheduleUnavailable}
              interestOnlyBalanceRemains={interestOnlyBalanceRemains}
              finalBalanceDueNow={finalBalanceDueNow}
              next={next}
              rateText={rateText}
            />
          )}
          {section === 'schedule' && (
            scheduleLoadingKey === scheduleKey ? (
              <div className="flex min-h-28 items-center justify-center gap-2 rounded-control bg-surface-2/70 text-label text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin text-accent-ink" aria-hidden="true" />
                Loading full planned schedule…
              </div>
            ) : (
              <>
                {scheduleErrorKey === scheduleKey && (
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-label text-muted-foreground">
                    <span>The full planned schedule could not be loaded.</span>
                    <Button variant="tertiary" size="sm" onClick={() => void loadSchedule()}>Retry</Button>
                  </div>
                )}
                <LoanScheduleList
                  rows={scheduleRows}
                  caption={`Planned schedule for ${loan.name}`}
                  empty={scheduleUnavailable ? 'The schedule is unavailable until the bill history is complete.' : 'Nothing left to schedule.'}
                  formatSensitive={formatSensitive}
                />
              </>
            )
          )}
          {section === 'history' && (
            <LoanScheduleList
              rows={actualRows}
              caption={`Payment history for ${loan.name}`}
              empty="No payments recorded yet."
              formatSensitive={formatSensitive}
            />
          )}
        </div>
      </div>
    </article>
  )
}

type LoanSection = 'details' | 'schedule' | 'history'

interface LoanScheduleRow extends LoanScheduleEntry {
  kind: 'Paid' | 'Planned'
}

/**
 * Payments as rows: date and amount on the line, the interest / principal split under it. Wide
 * screens get the same rows as a table, where the columns line up.
 */
function LoanScheduleList({ rows, caption, empty, formatSensitive }: {
  rows: LoanScheduleRow[]
  caption: string
  empty: string
  formatSensitive: (value: number) => ReactNode
}) {
  if (rows.length === 0) {
    return <p className="rounded-control bg-surface-2/70 px-3.5 py-4 text-center text-label text-muted-foreground">{empty}</p>
  }
  return (
    <div className="max-h-80 overflow-y-auto overscroll-contain rounded-control border border-border/60">
      <ul className="divide-y divide-border/50 min-[1280px]:hidden">
        {rows.map((row, index) => (
          <li key={`${row.occurrenceDate}-${row.kind}-${index}`} className="px-3.5 py-2.5 text-label">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium text-foreground">{formatOccurrenceDate(row.occurrenceDate)}</span>
                <LoanRowStatus kind={row.kind} />
              </span>
              <span className="shrink-0 font-semibold text-foreground tabular-nums">{formatSensitive(row.payment)}</span>
            </div>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-caption text-muted-foreground tabular-nums">
              <span>Interest {formatSensitive(row.interest)}</span>
              <span>Clears {formatSensitive(row.principal)}</span>
              <span>Owed after {formatSensitive(row.balanceAfter)}</span>
            </p>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-left text-label min-[1280px]:table">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-card text-caption text-muted-foreground shadow-[0_1px_0_var(--border)]">
          <tr>
            <th className="px-3.5 py-2 font-medium">Date</th>
            <th className="px-3.5 py-2 font-medium">Status</th>
            <th className="px-3.5 py-2 text-right font-medium">Payment</th>
            <th className="px-3.5 py-2 text-right font-medium">Interest</th>
            <th className="px-3.5 py-2 text-right font-medium">Clears debt</th>
            <th className="px-3.5 py-2 text-right font-medium">Still owed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50 tabular-nums">
          {rows.map((row, index) => (
            <tr key={`${row.occurrenceDate}-${row.kind}-${index}`}>
              <td className="px-3.5 py-2 font-medium text-foreground">{formatOccurrenceDate(row.occurrenceDate)}</td>
              <td className="px-3.5 py-2"><LoanRowStatus kind={row.kind} /></td>
              <td className="px-3.5 py-2 text-right font-semibold text-foreground">{formatSensitive(row.payment)}</td>
              <td className="px-3.5 py-2 text-right text-muted-foreground">{formatSensitive(row.interest)}</td>
              <td className="px-3.5 py-2 text-right text-foreground">{formatSensitive(row.principal)}</td>
              <td className="px-3.5 py-2 text-right font-semibold text-foreground">{formatSensitive(row.balanceAfter)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LoanRowStatus({ kind }: { kind: LoanScheduleRow['kind'] }) {
  return (
    <span className={cn(
      'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-caption font-medium',
      kind === 'Paid' ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground',
    )}>
      {kind === 'Paid' ? 'Recorded' : 'Planned'}
    </span>
  )
}
