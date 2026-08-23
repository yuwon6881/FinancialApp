import React from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { formatOccurrenceDate } from './formatters'

interface RecurringPaymentsHeaderProps {
  activeView: 'recurring' | 'loans'
  totalCommittedMonthly: number
  totalCommittedAnnual: number
  activeCount: number
  totalCount: number
  loanTotalOutstanding?: number | null
  loanCount?: number
  /** Nearest upcoming repayment date across tracked loans; null when it cannot be known yet. */
  loanNextPaymentDate?: string | null
  showAddForm: boolean
  hideSensitive: boolean
  formatSensitive: (val: number) => React.ReactNode
  onToggleForm: () => void
  onAddLoan?: () => void
}

/**
 * One stat tile. Both tabs render the same tile so the summary card keeps its shape when the
 * view switches -- the values differ, the type scale and truncation behaviour do not.
 */
const StatTile: React.FC<{
  label: string
  value: React.ReactNode
  tone?: 'figure' | 'count'
  title?: string
  className?: string
}> = ({ label, value, tone = 'figure', title, className = '' }) => (
  <div className={`min-w-0 overflow-hidden ${className}`}>
    <span className="block text-[9px] font-bold uppercase leading-tight tracking-wide text-muted-foreground sm:text-[10px] sm:tracking-wider">
      {label}
    </span>
    <span
      title={title}
      className={`block truncate text-base font-extrabold sm:text-2xl ${tone === 'figure' ? 'text-blue-500' : 'text-foreground'}`}
    >
      {value}
    </span>
  </div>
)

// Header section with Stats
export const RecurringPaymentsHeader: React.FC<RecurringPaymentsHeaderProps> = ({
  activeView,
  totalCommittedMonthly,
  totalCommittedAnnual,
  activeCount,
  totalCount,
  loanTotalOutstanding = null,
  loanCount = 0,
  loanNextPaymentDate = null,
  showAddForm,
  hideSensitive,
  formatSensitive,
  onToggleForm,
  onAddLoan,
}) => {
  const isLoansView = activeView === 'loans'

  return (
    <div className="w-full">
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 w-full md:flex-1">
          <h2 id={isLoansView ? 'loans-heading' : 'recurring-payments-heading'} className="text-xl font-bold text-foreground">
            {isLoansView ? 'Loans' : 'Recurring Bills & Subscriptions'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoansView ? 'Track what is still owed from linked bill history.' : 'Manage your recurring bills.'}
          </p>
          <div className="mt-4 grid min-w-0 grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 sm:gap-y-0">
            {isLoansView ? (
              <>
                <StatTile
                  label="Total still owed"
                  value={loanTotalOutstanding == null ? 'Unavailable' : formatSensitive(loanTotalOutstanding)}
                  className="pr-2"
                />
                <StatTile
                  label="Loans tracked"
                  value={loanCount}
                  tone="count"
                  className="border-l border-border/60 pl-2 pr-1 sm:px-2"
                />
                <StatTile
                  label="Next payment"
                  value={loanNextPaymentDate
                    ? formatOccurrenceDate(loanNextPaymentDate, { month: 'short', day: 'numeric' })
                    : 'Unavailable'}
                  title={loanNextPaymentDate ? formatOccurrenceDate(loanNextPaymentDate) : undefined}
                  tone="count"
                  className="col-span-2 border-t border-border/60 pt-2 sm:col-span-1 sm:border-t-0 sm:border-l sm:pl-2 sm:pt-0"
                />
              </>
            ) : (
              <>
                <StatTile label="Monthly Total" value={formatSensitive(totalCommittedMonthly)} className="pr-2" />
                <StatTile
                  label="Yearly Total"
                  value={formatSensitive(totalCommittedAnnual)}
                  className="border-l border-border/60 pl-2 pr-1 sm:px-2"
                />
                <StatTile
                  label="Active bills"
                  value={`${activeCount} / ${totalCount}`}
                  tone="count"
                  className="col-span-2 border-t border-border/60 pt-2 sm:col-span-1 sm:border-t-0 sm:border-l sm:pl-2 sm:pt-0"
                />
              </>
            )}
          </div>
        </div>
        {isLoansView ? (
          <Button
            variant="primary"
            size="lg"
            onClick={onAddLoan}
            disabled={hideSensitive || !onAddLoan}
            title={hideSensitive ? 'Unhide balances to add a loan' : undefined}
            className="rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 duration-200 self-start md:self-center"
          >
            <Plus className="size-4" />
            New Loan
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={onToggleForm}
            disabled={hideSensitive}
            title={hideSensitive ? 'Unhide balances to add a subscription' : undefined}
            className="rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 duration-200 self-start md:self-center"
          >
            {showAddForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showAddForm ? 'Cancel' : 'New Subscription'}
          </Button>
        )}
      </Card>
    </div>
  )
}
