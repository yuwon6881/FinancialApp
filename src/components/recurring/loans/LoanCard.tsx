import { Pencil, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchLoanSchedule } from '../../../lib/api/loans'
import type { Loan, LoanScheduleEntry } from '../../../types'
import { Button } from '../../ui/Button'
import { AlertBanner } from '../../ui/AlertBanner'
import { InfoHint } from '../../ui/InfoHint'
import { RowSyncStatus } from '../../ui/RowSyncBadge'

interface LoanCardProps {
  loan: Loan
  currency: string
  hideSensitive: boolean
  formatSensitive: (value: number) => ReactNode
  isSyncing: boolean
  onEdit: () => void
  onDelete: () => void
}

const methodLabel = (method: Loan['interestMethod']) =>
  method === 'Flat' ? 'Interest on the original amount' : "Interest on what's left"

const formatDate = (value?: string | null) => value
  ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  : 'Unavailable'

export function LoanCard({
  loan,
  currency,
  hideSensitive,
  formatSensitive,
  isSyncing,
  onEdit,
  onDelete,
}: LoanCardProps) {
  const scheduleUnavailable = loan.scheduleStatus === 'Incomplete' || !loan.scheduleFrequency || !loan.scheduleDueDay || !loan.scheduleStartDate
  const next = loan.snapshot.nextPayment
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
  const [loadedSchedule, setLoadedSchedule] = useState<{ key: string; rows: LoanScheduleEntry[] } | null>(null)
  const [scheduleLoadingKey, setScheduleLoadingKey] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState(false)
  const loadSchedule = useCallback(async () => {
    if (loan.isPendingSync || scheduleUnavailable) return
    const key = scheduleKey
    setScheduleLoadingKey(key)
    setScheduleError(false)
    try {
      const rows = await fetchLoanSchedule(loan.id)
      setLoadedSchedule({ key, rows })
    } catch {
      setScheduleError(true)
    } finally {
      setScheduleLoadingKey(current => current === key ? null : current)
    }
  }, [loan.id, loan.isPendingSync, scheduleKey, scheduleUnavailable])

  useEffect(() => {
    if (!isScheduleOpen || loan.isPendingSync || scheduleUnavailable || loadedSchedule?.key === scheduleKey || scheduleLoadingKey === scheduleKey) return
    void loadSchedule()
  }, [isScheduleOpen, loadSchedule, loadedSchedule?.key, loan.isPendingSync, scheduleKey, scheduleLoadingKey, scheduleUnavailable])

  const scheduleRows = (loadedSchedule?.key === scheduleKey ? loadedSchedule.rows : loan.snapshot.futureSchedule)
    .map(payment => ({ ...payment, kind: 'Planned' as const }))

  return (
    <article className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-foreground">{loan.name}</h3>
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
              : 'This bill was deleted - this loan keeps its original history.'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label={`Edit ${loan.name}`} title={hideSensitive ? 'Unhide balances to edit' : 'Edit loan'} onClick={onEdit} disabled={hideSensitive}>
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="destructiveGhost" size="icon" aria-label={`Delete ${loan.name}`} title={hideSensitive ? 'Unhide balances to delete' : 'Delete loan'} onClick={onDelete} disabled={hideSensitive}>
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {loan.scheduleStatus === 'NeedsReview' && (
        <AlertBanner variant="warning" className="mt-4">
          This loan predates the saved cadence. Its schedule was recovered from the linked bill and needs your review before you rely on the forecast.
        </AlertBanner>
      )}

      {scheduleUnavailable ? (
        <AlertBanner variant="warning" className="mt-4">
          This loan cannot show a trustworthy balance or payment schedule because its original bill cadence or payment history is incomplete. Keep this history with the loan; create a separate loan for a different bill.
        </AlertBanner>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Still owed" value={formatSensitive(loan.snapshot.outstandingBalance)} />
          <Metric label="Next instalment" value={formatSensitive(loan.snapshot.scheduledPayment)} />
          <Metric label="Expected payoff" value={formatDate(loan.snapshot.payoffDate)} />
          <Metric label="Total interest" value={formatSensitive(loan.snapshot.totalScheduledInterest)} />
        </div>
      )}

      <div className="mt-4 grid gap-3 rounded-xl border border-border/50 bg-muted/20 p-3 text-xs sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">Interest method</p>
          <p className="mt-1 font-semibold text-foreground">{methodLabel(loan.interestMethod)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Next instalment split</p>
          {scheduleUnavailable ? (
            <p className="mt-1 font-semibold text-muted-foreground">Unavailable</p>
          ) : next ? (
            <p className="mt-1 font-semibold text-foreground">
              {formatSensitive(next.principal)} clears the debt · {formatSensitive(next.interest)} interest
            </p>
          ) : (
            <p className="mt-1 font-semibold text-muted-foreground">Unavailable</p>
          )}
        </div>
        <div className="flex items-start gap-1.5">
          <p className="text-muted-foreground">Why this matters: the payoff date is calculated from the recorded bill history.</p>
          <InfoHint label="loan payoff warning" text="A payment that does not cover that period's interest reduces none of the amount owed, so the payoff date is not promised." />
        </div>
      </div>

      <details className="mt-4 rounded-xl border border-border/50 bg-background/40 p-3" onToggle={event => setIsScheduleOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer select-none text-xs font-bold text-foreground hover:text-accent-ink transition-colors">
          Payment history and planned schedule ({actualRows.length + scheduleRows.length})
        </summary>
        {scheduleLoadingKey === scheduleKey && (
          <p className="mt-3 text-xs text-muted-foreground">Loading the full planned schedule…</p>
        )}
        {scheduleError && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>The full planned schedule could not be loaded.</span>
            <Button variant="ghost" size="sm" onClick={() => void loadSchedule()} disabled={scheduleLoadingKey === scheduleKey}>Retry</Button>
          </div>
        )}
        <div className="mt-3 max-h-72 overflow-x-auto overflow-y-auto rounded-lg border border-border/40 bg-card/60">
          <table className="w-full min-w-[620px] text-left text-xs">
            <caption className="sr-only">Payment history and planned schedule for {loan.name}</caption>
            <thead className="sticky top-0 z-10 bg-card border-b border-border/40 text-muted-foreground shadow-2xs">
              <tr>
                <th className="px-2.5 py-2 font-semibold">Date</th>
                <th className="px-2.5 py-2 font-semibold">Status</th>
                <th className="px-2.5 py-2 text-right font-semibold">Payment</th>
                <th className="px-2.5 py-2 text-right font-semibold">Interest</th>
                <th className="px-2.5 py-2 text-right font-semibold">Clears debt</th>
                <th className="px-2.5 py-2 text-right font-semibold">Still owed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {[...actualRows, ...scheduleRows].map((row, index) => (
                <tr key={`${row.occurrenceDate}-${row.kind}-${index}`} className="hover:bg-muted/30 transition-colors">
                  <td className="px-2.5 py-2 font-medium text-foreground">{formatDate(row.occurrenceDate)}</td>
                  <td className="px-2.5 py-2">
                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                      row.kind === 'Paid'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {row.kind === 'Paid' ? 'Recorded' : 'Planned'}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-right font-semibold text-foreground">{formatSensitive(row.payment)}</td>
                  <td className="px-2.5 py-2 text-right text-muted-foreground">{formatSensitive(row.interest)}</td>
                  <td className="px-2.5 py-2 text-right text-foreground">{formatSensitive(row.principal)}</td>
                  <td className="px-2.5 py-2 text-right font-semibold text-foreground">{formatSensitive(row.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="mt-3 text-[11px] text-muted-foreground">Amounts shown in {currency}. The original bill cadence determines the order, even when it was paid early.</p>
    </article>
  )
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-3">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
    </div>
  )
}
