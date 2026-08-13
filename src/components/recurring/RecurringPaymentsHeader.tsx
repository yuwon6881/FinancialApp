import React from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

interface RecurringPaymentsHeaderProps {
  activeView: 'recurring' | 'loans'
  totalCommittedMonthly: number
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
        <div>
          <h2 id={isLoansView ? 'loans-heading' : 'recurring-payments-heading'} className="text-xl font-bold text-foreground">
            {isLoansView ? 'Loans' : 'Recurring Bills & Subscriptions'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoansView ? 'Track what is still owed from linked bill history.' : 'Manage your recurring bills.'}
          </p>
          <div className="flex gap-4 mt-4">
            {isLoansView ? (
              <>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Total still owed</span>
                  <span className="text-2xl font-extrabold text-blue-500">
                    {loanTotalOutstanding == null ? 'Unavailable' : formatSensitive(loanTotalOutstanding)}
                  </span>
                </div>
                <div className="border-l border-border/60 pl-4">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Loans tracked</span>
                  <span className="text-2xl font-extrabold text-foreground">{loanCount}</span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Monthly Total</span>
                  <span className="text-2xl font-extrabold text-blue-500">{formatSensitive(totalCommittedMonthly)}</span>
                </div>
                <div className="border-l border-border/60 pl-4">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Active Subscriptions</span>
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
