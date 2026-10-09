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

/** One fact as a row: the label (with its hint) on the left, the value on the right. */
function DetailCell({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 py-2">
      <dt className="flex shrink-0 items-center gap-1 text-muted-foreground">
        {label}
        {hint && <InfoHint inline label={label} text={hint} />}
      </dt>
      <dd className="min-w-0 break-words text-right font-medium text-foreground">{children}</dd>
    </div>
  )
}

/**
 * The loan card's Details section.
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
    <dl className="grid min-w-0 max-w-full divide-y divide-border/50 text-label sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0 sm:[&>*]:border-b sm:[&>*]:border-border/50 sm:[&>*:nth-last-child(-n+2)]:border-b-0">
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
    </dl>
  )
}
