import type { ReactNode } from 'react'
import type { Loan, LoanScheduleEntry } from '../../../types'
import { SENSITIVE_AMOUNT_MASK } from '../../../lib/utils'
import { loanInterestMethodCopy } from '../../../lib/loanTerms'
import { InfoHint } from '../../ui/InfoHint'
import { formatOccurrenceDate } from '../formatters'

interface LoanCardDetailsProps {
  loan: Loan
  hideSensitive: boolean
  formatSensitive: (value: number) => ReactNode
  scheduleUnavailable: boolean
  interestOnlyBalanceRemains: boolean
  finalBalanceDueNow: boolean
  next: LoanScheduleEntry | null | undefined
  rateText: string
}

/** A single detail cell with a muted label above the value. */
function DetailCell({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/20 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <p className="text-[0.6875rem] font-medium text-muted-foreground">{label}</p>
        {hint && <InfoHint label={label} text={hint} />}
      </div>
      <p className="mt-1 text-xs font-semibold text-foreground">{children}</p>
    </div>
  )
}

/**
 * The body of the loan card's "Loan details" disclosure.
 *
 * Extracted so demoting the payoff and remaining-interest figures off the summary did not grow an
 * already-oversized card component. Expected payoff and Remaining interest live here rather than
 * on the summary: they answer "how does this end", which is a different question from "what do I
 * owe now" and does not need to compete with it for the first glance.
 */
export function LoanCardDetails({
  loan,
  hideSensitive,
  formatSensitive,
  scheduleUnavailable,
  interestOnlyBalanceRemains,
  finalBalanceDueNow,
  next,
  rateText,
}: LoanCardDetailsProps) {
  const methodCopy = loanInterestMethodCopy(loan.interestMethod)
  return (
    <div className="grid gap-2 border-t border-border/50 p-3 sm:grid-cols-2 lg:grid-cols-3 lg:border-t-0">
      <DetailCell label="Expected payoff">
        {interestOnlyBalanceRemains ? 'No automatic payoff' : formatOccurrenceDate(loan.snapshot.payoffDate)}
      </DetailCell>
      <DetailCell label="Remaining interest">
        {formatSensitive(loan.snapshot.totalScheduledInterest)}
      </DetailCell>
      <DetailCell label="Interest rate">
        <span aria-hidden={hideSensitive || undefined}>{hideSensitive ? SENSITIVE_AMOUNT_MASK : rateText}</span>
      </DetailCell>
      <DetailCell label="Interest method" hint={methodCopy.hint}>
        {methodCopy.label}
      </DetailCell>
      <DetailCell label="Next instalment split">
        {scheduleUnavailable ? (
          <span className="text-muted-foreground">Unavailable</span>
        ) : next ? (
          <>
            {formatSensitive(next.principal)} clears the debt · {formatSensitive(next.interest)} interest
          </>
        ) : finalBalanceDueNow ? (
          <span className="text-muted-foreground">Final balance due now</span>
        ) : (
          <span className="text-muted-foreground">Unavailable</span>
        )}
      </DetailCell>
      <DetailCell label="Payoff estimation" hint="A payment that does not cover that period's interest reduces none of the amount owed, so the payoff date is not promised.">
        Calculated from bill history.
      </DetailCell>
    </div>
  )
}
