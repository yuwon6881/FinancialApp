import React from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

interface RecurringPaymentsHeaderProps {
  totalCommittedMonthly: number
  activeCount: number
  totalCount: number
  showAddForm: boolean
  formatSensitive: (val: number) => React.ReactNode
  onToggleForm: () => void
}

// Header section with Stats
export const RecurringPaymentsHeader: React.FC<RecurringPaymentsHeaderProps> = ({
  totalCommittedMonthly,
  activeCount,
  totalCount,
  showAddForm,
  formatSensitive,
  onToggleForm,
}) => {
  return (
    <div className="w-full">
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Recurring Bills & Subscriptions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Track, toggle, and manage your recurring committed outlays.</p>
          <div className="flex gap-4 mt-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Monthly Total</span>
              <span className="text-2xl font-extrabold text-blue-500">{formatSensitive(totalCommittedMonthly)}</span>
            </div>
            <div className="border-l border-border/60 pl-4">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Active Subscriptions</span>
              <span className="text-2xl font-extrabold text-foreground">{activeCount} / {totalCount}</span>
            </div>
          </div>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={onToggleForm}
          className="rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 duration-200 self-start md:self-center"
        >
          {showAddForm ? <X className="size-4" /> : <Plus className="size-4" />}
          {showAddForm ? 'Cancel' : 'New Subscription'}
        </Button>
      </Card>
    </div>
  )
}
