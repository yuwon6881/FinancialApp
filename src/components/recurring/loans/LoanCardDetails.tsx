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
  return (
        <div className="grid gap-3 border-t border-border/50 p-3 text-xs sm:grid-cols-3 lg:grid-cols-6 lg:border-t-0">
          <div>
            <p className="text-muted-foreground">Expected payoff</p>
            <p className="mt-1 font-semibold text-foreground">
              {interestOnlyBalanceRemains ? 'No automatic payoff' : formatOccurrenceDate(loan.snapshot.payoffDate)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Remaining interest</p>
            <p className="mt-1 font-semibold text-foreground">{formatSensitive(loan.snapshot.totalScheduledInterest)}</p>
          </div>
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
  )
}
