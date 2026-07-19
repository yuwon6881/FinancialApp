import React from 'react'
import type { ActiveRecurringPayment, RecurringPayment, Transaction } from '../../types'
import { BillTimeline } from '../BillTimeline'

interface RecurringTimelineCardProps {
  activeRecurringPayments: ActiveRecurringPayment[]
  allPayments: RecurringPayment[]
  transactions: Transaction[]
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  currency: string
  hideSensitive: boolean
}

// Visual Bill Timeline
export const RecurringTimelineCard: React.FC<RecurringTimelineCardProps> = ({
  activeRecurringPayments,
  allPayments,
  transactions,
  selectedMonth,
  selectedYear,
  cycleDay,
  currency,
  hideSensitive,
}) => {
  return (
    <div className="space-y-4">
      <BillTimeline
        title="Subscriptions Billing Timeline"
        cycleOffset={0}
        activeRecurringPayments={activeRecurringPayments}
        allPayments={allPayments}
        transactions={transactions}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        cycleDay={cycleDay}
        currency={currency}
        hideSensitive={hideSensitive}
      />
    </div>
  )
}
