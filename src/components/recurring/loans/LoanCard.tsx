import { ChevronDown, Edit, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchLoanSchedule } from '../../../lib/api/loans'
import { SENSITIVE_AMOUNT_MASK } from '../../../lib/utils'
import { entryRateFromAnnual, formatRatePercent, loanInterestMethodCopy } from '../../../lib/loanTerms'
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
  isMobile?: boolean
  onEdit: () => void
  onDelete: () => void
  onExplain: () => void
}
const formatDate = (value?: string | null) => value
  ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  : 'Unavailable'

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
}: LoanCardProps) {
  const scheduleUnavailable = loan.isRecalculating === true || loan.scheduleStatus === 'Incomplete' || !loan.scheduleFrequency || !loan.scheduleDueDay || !loan.scheduleStartDate
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
        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <Metric label="Still owed" value={formatSensitive(loan.snapshot.outstandingBalance)} />
          <Metric label="Next instalment" value={finalBalanceDueNow ? 'Final balance due now' : formatSensitive(loan.snapshot.scheduledPayment)} />
          <Metric label="Expected payoff" value={interestOnlyBalanceRemains ? 'No automatic payoff' : formatDate(loan.snapshot.payoffDate)} />
          <Metric label="Remaining interest" value={formatSensitive(loan.snapshot.totalScheduledInterest)} />
        </div>
      )}

      <details className="group/loan-details mt-3 rounded-xl border border-border/50 bg-muted/15 lg:mt-4 lg:bg-muted/20" open={isLoanDetailsOpen} onToggle={event => setIsLoanDetailsOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-bold text-foreground outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/50 lg:hidden">
          <span>Loan details</span>
          <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open/loan-details:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-3 border-t border-border/50 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4 lg:border-t-0">
          <div>
            <div className="flex items-start gap-1.5">
              <div>
                <p className="text-muted-foreground">Interest method</p>
                <p className="mt-1 font-semibold text-foreground">{loanInterestMethodCopy(loan.interestMethod).label}</p>
              </div>
              <InfoHint label="interest method" text={loanInterestMethodCopy(loan.interestMethod).hint} />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">Interest rate</p>
            <p className="mt-1 font-semibold text-foreground" aria-hidden={hideSensitive || undefined}>{hideSensitive ? SENSITIVE_AMOUNT_MASK : rateText}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Next instalment split</p>
            {scheduleUnavailable ? (
              <p className="mt-1 font-semibold text-muted-foreground">Unavailable</p>
            ) : next ? (
              <p className="mt-1 font-semibold text-foreground">
                {formatSensitive(next.principal)} clears the debt · {formatSensitive(next.interest)} interest
              </p>
            ) : finalBalanceDueNow ? (
              <p className="mt-1 font-semibold text-muted-foreground">Final balance due now</p>
            ) : (
              <p className="mt-1 font-semibold text-muted-foreground">Unavailable</p>
            )}
          </div>
          <div>
            <div className="flex items-start gap-1.5">
              <div>
                <p className="text-muted-foreground">Payoff estimation</p>
                <p className="mt-1 font-medium text-foreground">Calculated from bill history.</p>
              </div>
              <InfoHint label="loan payoff warning" text="A payment that does not cover that period's interest reduces none of the amount owed, so the payoff date is not promised." />
            </div>
          </div>
        </div>
      </details>

      <details className="group/schedule mt-3 rounded-xl border border-border/50 bg-background/40 p-3 sm:p-3.5" onToggle={event => setIsScheduleOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer select-none items-center justify-between gap-2 text-xs font-bold text-foreground transition-colors hover:text-accent-ink">
          <div className="flex items-center gap-2">
            <span>Payment history and planned schedule</span>
            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {actualRows.length + scheduleRows.length}
            </span>
          </div>
          <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open/schedule:rotate-180" aria-hidden />
        </summary>
        {scheduleLoadingKey === scheduleKey && (
          <p className="mt-3 text-xs text-muted-foreground">Loading full planned schedule…</p>
        )}
        {scheduleError && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>The full planned schedule could not be loaded.</span>
            <Button variant="ghost" size="sm" onClick={() => void loadSchedule()} disabled={scheduleLoadingKey === scheduleKey}>Retry</Button>
          </div>
        )}
        {/* Mobile schedule: compact, full-width cards with no horizontal scrolling */}
        <div className="mt-3 max-h-72 overflow-y-auto space-y-2 sm:hidden pr-0.5">
          {[...actualRows, ...scheduleRows].map((row, index) => (
            <div
              key={`${row.occurrenceDate}-${row.kind}-${index}`}
              className="rounded-lg border border-border/40 bg-card/60 p-2.5 text-xs transition-colors hover:bg-muted/20"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-foreground">{formatDate(row.occurrenceDate)}</span>
                  <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                    row.kind === 'Paid'
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {row.kind === 'Paid' ? 'Recorded' : 'Planned'}
                  </span>
                </div>
                <span className="font-bold text-foreground tabular-nums">{formatSensitive(row.payment)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/25 pt-1.5 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-2 truncate">
                  <span>Interest: <strong className="font-semibold text-muted-foreground">{formatSensitive(row.interest)}</strong></span>
                  <span>·</span>
                  <span>Clears: <strong className="font-semibold text-foreground">{formatSensitive(row.principal)}</strong></span>
                </div>
                <span className="shrink-0 font-medium text-foreground">Owed: <strong className="font-semibold text-foreground">{formatSensitive(row.balanceAfter)}</strong></span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop schedule: tabular view */}
        <div className="mt-3 hidden max-h-72 overflow-x-auto overflow-y-auto rounded-lg border border-border/40 bg-card/60 sm:block">
          <table className="w-full min-w-[580px] text-left text-xs">
            <caption className="sr-only">Payment history and planned schedule for {loan.name}</caption>
            <thead className="sticky top-0 z-10 border-b border-border/40 bg-card text-[11px] text-muted-foreground shadow-2xs">
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
                  <td className="px-3 py-2 font-medium text-foreground">{formatDate(row.occurrenceDate)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
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
        <p className="mt-2.5 text-[11px] text-muted-foreground">Amounts in {currency}. Schedule follows original bill cadence.</p>
      </details>

      <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-4 gap-2">
        <Button
          variant="secondary"
          size="sm"
          type="button"
          aria-label={`Explain ${loan.name} with Ask AI`}
          title={hideSensitive ? 'Unhide balances to explain this loan' : 'Explain this loan with Ask AI'}
          onClick={onExplain}
          disabled={hideSensitive || loan.isPendingSync || loan.isRecalculating}
          className="shrink-0"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          <span>Explain this loan</span>
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
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
            variant="danger"
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

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/50 p-2.5 sm:p-3">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold text-foreground sm:text-base">{value}</p>
    </div>
  )
}
