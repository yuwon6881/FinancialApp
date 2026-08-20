import React from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

interface RecurringPaymentsHeaderProps {
  activeView: 'recurring' | 'loans'
  totalCommittedMonthly: number
  totalCommittedAnnual: number
  activeCount: number
  totalCount: number
  loanTotalOutstanding?: number | null
  loanCount?: number
  showAddForm: boolean
  hideSensitive: boolean
  formatSensitive: (val: number) => React.ReactNode
  onToggleForm: () => void
}

// Header section with Stats
export const RecurringPaymentsHeader: React.FC<RecurringPaymentsHeaderProps> = ({
  activeView,
  totalCommittedMonthly,
  totalCommittedAnnual,
  activeCount,
  totalCount,
  loanTotalOutstanding = null,
  loanCount = 0,
  showAddForm,
  hideSensitive,
  formatSensitive,
  onToggleForm,
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
          <div className={`mt-4 grid min-w-0 ${isLoansView ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {isLoansView ? (
              <>
                <div className="min-w-0 pr-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Total still owed</span>
                  <span className="text-2xl font-extrabold text-blue-500">
                    {loanTotalOutstanding == null ? 'Unavailable' : formatSensitive(loanTotalOutstanding)}
                  </span>
                </div>
                <div className="min-w-0 border-l border-border/60 pl-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Loans tracked</span>
                  <span className="text-2xl font-extrabold text-foreground">{loanCount}</span>
                </div>
              </>
            ) : (
              <>
                <div className="min-w-0 pr-2">
                  <span className="block text-[9px] font-bold uppercase leading-tight tracking-wide text-muted-foreground sm:text-[10px] sm:tracking-wider">Monthly Total</span>
                  <span className="text-2xl font-extrabold text-blue-500">{formatSensitive(totalCommittedMonthly)}</span>
                </div>
                <div className="min-w-0 border-l border-border/60 px-2">
                  <span className="block text-[9px] font-bold uppercase leading-tight tracking-wide text-muted-foreground sm:text-[10px] sm:tracking-wider">Yearly Total</span>
                  <span className="text-2xl font-extrabold text-blue-500">{formatSensitive(totalCommittedAnnual)}</span>
                </div>
                <div className="min-w-0 border-l border-border/60 pl-2">
                  <span className="block text-[9px] font-bold uppercase leading-tight tracking-wide text-muted-foreground sm:text-[10px] sm:tracking-wider">Active bills</span>
                  <span className="text-2xl font-extrabold text-foreground">{activeCount} / {totalCount}</span>
                </div>
              </>
            )}
          </div>
        </div>
        {!isLoansView && (
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
