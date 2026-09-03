import { ChevronDown, Edit, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchLoanSchedule } from '../../../lib/api/loans'
import { entryRateFromAnnual, formatRatePercent, loanPayoffProgress } from '../../../lib/loanTerms'
import type { Loan, LoanScheduleEntry } from '../../../types'
import { Button } from '../../ui/Button'
import { AlertBanner } from '../../ui/AlertBanner'
import { Meter } from '../../ui/Meter'
import { RowSyncStatus } from '../../ui/RowSyncBadge'
import { formatOccurrenceDate } from '../formatters'
import { LoanCardDetails } from './LoanCardDetails'

interface LoanCardProps {
  loan: Loan
  currency: string
  hideSensitive: boolean
  formatSensitive: (value: number) => ReactNode
  isSyncing: boolean
  isMobile?: boolean
  onEdit: () => void
  onDelete: () => void
  onExplain: () => void
  onRepay?: () => void
  onUndoSettlement?: () => void
}

export function LoanCard({
  loan,
  currency,
  hideSensitive,
  formatSensitive,
  isSyncing,
  isMobile = false,
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
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [isLoanDetailsOpen, setIsLoanDetailsOpen] = useState(!isMobile)
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

  const handleScheduleToggle = useCallback(() => {
    if (isScheduleOpen) {
      setIsScheduleOpen(false)
      return
    }

    const needsFullSchedule = !loan.isPendingSync
      && !scheduleUnavailable
      && loadedSchedule?.key !== scheduleKey
      && scheduleLoadingKey !== scheduleKey
    if (needsFullSchedule) {
      // Native <details> reveals its children before React receives `toggle`, which allowed the
      // six-row list preview to paint for a frame before this loader. A controlled disclosure
      // commits open + loading together, so stale preview rows can never become visible first.
      setScheduleLoadingKey(scheduleKey)
      setScheduleErrorKey(null)
      void loadSchedule()
    }
    setIsScheduleOpen(true)
  }, [isScheduleOpen, loadSchedule, loadedSchedule?.key, loan.isPendingSync, scheduleKey, scheduleLoadingKey, scheduleUnavailable])

  useEffect(() => {
    if (!isScheduleOpen || loan.isPendingSync || scheduleUnavailable || loadedSchedule?.key === scheduleKey || scheduleLoadingKey === scheduleKey) return
    void loadSchedule()
  }, [isScheduleOpen, loadSchedule, loadedSchedule?.key, loan.isPendingSync, scheduleKey, scheduleLoadingKey, scheduleUnavailable])

  useEffect(() => {
    setIsLoanDetailsOpen(!isMobile)
  }, [isMobile])

  const scheduleRows = (loadedSchedule?.key === scheduleKey ? loadedSchedule.rows : loan.snapshot.futureSchedule)
    .map(payment => ({ ...payment, kind: 'Planned' as const }))

  return (
    <article id={`loan-card-${loan.id}`} className="rounded-2xl border border-border/60 bg-card/85 p-4 shadow-sm sm:p-5 transition-all duration-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold tracking-tight text-foreground">{loan.name}</h3>
            <RowSyncStatus
              entityLabel="loan"
              isDeleting={loan.isPendingDelete === true}
              isSyncing={isSyncing}
              isPending={loan.isPendingSync === true}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {loan.recurringPaymentExists
              ? `Linked bill: ${loan.recurringPaymentName || 'Recurring bill'}`
              : 'Bill removed · original history preserved'}
          </p>
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
        <div className="mt-4 space-y-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Still owed</p>
            <p className="text-2xl font-black tracking-tight text-foreground">
              {formatSensitive(loan.snapshot.outstandingBalance)}
            </p>
          </div>

          {/* Anchored on the principal at the tracking start date, so the copy says "tracked" and
              never "borrowed": a loan added part-way through its life has no record of what came
              before it. Absent entirely when the figure is not knowable. */}
          {payoffProgress && (
            <div className="space-y-1">
              <Meter
                percent={payoffProgress.percentPaid}
                tone="bg-primary"
                label={`${payoffProgress.percentPaid.toFixed(0)}% of the tracked principal cleared`}
              />
              <p className="text-xs font-semibold text-muted-foreground">
                {payoffProgress.percentPaid.toFixed(0)}% paid off ·{' '}
                {formatSensitive(payoffProgress.clearedPrincipal)} cleared of{' '}
                {formatSensitive(payoffProgress.trackedPrincipal)} tracked
              </p>
            </div>
          )}

          <p className="text-xs font-semibold text-muted-foreground">
            Next instalment{' '}
            <span className="font-bold text-foreground">
              {finalBalanceDueNow ? 'Final balance due now' : formatSensitive(loan.snapshot.scheduledPayment)}
            </span>
          </p>
        </div>
      )}

      <details className="group/loan-details mt-3 rounded-xl border border-border/50 bg-muted/15 lg:mt-4 lg:bg-muted/20" open={isLoanDetailsOpen} onToggle={event => setIsLoanDetailsOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-bold text-foreground outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/50 min-[1280px]:hidden">
          <span>Loan details</span>
          <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open/loan-details:rotate-180" aria-hidden />
        </summary>
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
      </details>

      <div className="mt-3 rounded-xl border border-border/50 bg-background/40 p-3 sm:p-3.5">
        <Button
          variant="tertiary"
          type="button"
          aria-expanded={isScheduleOpen}
          aria-controls={isScheduleOpen ? `loan-schedule-${loan.id}` : undefined}
          onClick={handleScheduleToggle}
          className="flex min-h-11 w-full cursor-pointer select-none items-center justify-between gap-2 rounded-lg text-left text-xs font-bold text-foreground transition-colors hover:text-accent-ink sm:min-h-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate">Payment history and planned schedule</span>
            <span className="shrink-0 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {actualRows.length + scheduleRows.length}
            </span>
          </div>
          <ChevronDown className={`size-3.5 text-muted-foreground transition-transform shrink-0 ${isScheduleOpen ? 'rotate-180' : ''}`} aria-hidden />
        </Button>
        {isScheduleOpen && (
          <div id={`loan-schedule-${loan.id}`} className="min-w-0 max-w-full overflow-hidden">
            {scheduleLoadingKey === scheduleKey ? (
              <div className="mt-3 flex min-h-28 items-center justify-center gap-2 rounded-lg border border-border/40 bg-card/40 text-xs font-semibold text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin text-accent-ink" aria-hidden="true" />
                Loading full planned schedule…
              </div>
            ) : (
              <>
            {scheduleErrorKey === scheduleKey && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>The full planned schedule could not be loaded.</span>
                <Button variant="tertiary" size="sm" onClick={() => void loadSchedule()}>Retry</Button>
              </div>
            )}
            {/* Mobile schedule: compact, full-width cards with responsive wrapping */}
            <div className="mt-3 max-h-72 space-y-2 overflow-x-hidden overflow-y-auto pr-0.5 min-[1280px]:hidden min-w-0 max-w-full">
          {[...actualRows, ...scheduleRows].map((row, index) => (
            <div
              key={`${row.occurrenceDate}-${row.kind}-${index}`}
              className="rounded-lg border border-border/40 bg-card/60 p-2.5 text-xs transition-colors hover:bg-muted/20 min-w-0"
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-semibold text-foreground truncate">{formatOccurrenceDate(row.occurrenceDate)}</span>
                  <span className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-bold ${
                    row.kind === 'Paid'
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {row.kind === 'Paid' ? 'Recorded' : 'Planned'}
                  </span>
                </div>
                <span className="font-bold text-foreground tabular-nums shrink-0">{formatSensitive(row.payment)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/25 pt-1.5 text-xs text-muted-foreground min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                  <span className="whitespace-nowrap">Interest: <strong className="font-semibold text-muted-foreground">{formatSensitive(row.interest)}</strong></span>
                  <span className="text-border/60">·</span>
                  <span className="whitespace-nowrap">Clears: <strong className="font-semibold text-foreground">{formatSensitive(row.principal)}</strong></span>
                </div>
                <span className="font-medium text-foreground whitespace-nowrap">Owed: <strong className="font-semibold text-foreground">{formatSensitive(row.balanceAfter)}</strong></span>
              </div>
            </div>
          ))}
            </div>

            {/* Desktop schedule: tabular view */}
            <div className="mt-3 hidden max-h-72 overflow-x-hidden overflow-y-auto rounded-lg border border-border/40 bg-card/60 min-[1280px]:block">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Payment history and planned schedule for {loan.name}</caption>
            <thead className="sticky top-0 z-10 border-b border-border/40 bg-card text-xs text-muted-foreground shadow-2xs">
              <tr>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Payment</th>
                <th className="px-3 py-2 text-right font-semibold">Interest</th>
                <th className="px-3 py-2 text-right font-semibold">Clears debt</th>
                <th className="px-3 py-2 text-right font-semibold">Still owed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {[...actualRows, ...scheduleRows].map((row, index) => (
                <tr key={`${row.occurrenceDate}-${row.kind}-${index}`} className="transition-colors hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium text-foreground">{formatOccurrenceDate(row.occurrenceDate)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                      row.kind === 'Paid'
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {row.kind === 'Paid' ? 'Recorded' : 'Planned'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{formatSensitive(row.payment)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{formatSensitive(row.interest)}</td>
                  <td className="px-3 py-2 text-right text-foreground">{formatSensitive(row.principal)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{formatSensitive(row.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground">Amounts in {currency}. Schedule follows original bill cadence.</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-t border-border/30 pt-4">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          {loan.settlementActionId && onUndoSettlement && (
            <Button
              variant="secondary"
              size="sm"
              type="button"
              aria-label={`Undo the full settlement of ${loan.name}`}
              title={hideSensitive ? 'Unhide balances to undo this settlement' : 'Reopen this loan and restore its recurring bill'}
              onClick={onUndoSettlement}
              disabled={hideSensitive || loan.isPendingSync || loan.isRecalculating}
              className="w-full justify-center sm:w-auto"
            >
              <span>Undo settlement</span>
            </Button>
          )}
          {loan.snapshot.outstandingBalance > 0 && !scheduleUnavailable && onRepay && (
            <Button
              variant="primary"
              size="sm"
              type="button"
              aria-label={`Make a payment for ${loan.name}`}
              title={hideSensitive ? 'Unhide balances to repay' : 'Pay instalments in advance or record full settlement'}
              onClick={onRepay}
              disabled={hideSensitive || loan.isPendingSync || loan.isRecalculating}
              className="w-full justify-center sm:w-auto shadow-sm"
            >
              <span>Make payment</span>
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            type="button"
            aria-label={`Explain ${loan.name} with Ask AI`}
            title={hideSensitive ? 'Unhide balances to explain this loan' : 'Explain this loan with Ask AI'}
            onClick={onExplain}
            disabled={hideSensitive || loan.isPendingSync || loan.isRecalculating}
            className={`w-full justify-center sm:w-auto ${!(loan.snapshot.outstandingBalance > 0 && !scheduleUnavailable && onRepay) ? 'col-span-2' : ''}`}
          >
            <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Explain this loan</span>
          </Button>
        </div>
        <div className="flex items-center justify-end gap-1.5 pt-1 sm:pt-0 border-t border-border/20 sm:border-t-0">
          <Button
            variant="tertiary"
            size="sm"
            aria-label={`Edit ${loan.name}`}
            title={hideSensitive ? 'Unhide balances to edit' : 'Edit loan'}
            onClick={onEdit}
            disabled={hideSensitive}
          >
            <Edit className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Edit</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            aria-label={`Delete ${loan.name}`}
            title={hideSensitive ? 'Unhide balances to delete' : 'Delete loan'}
            onClick={onDelete}
            disabled={hideSensitive}
          >
            <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Delete</span>
          </Button>
        </div>
      </div>
    </article>
  )
}
