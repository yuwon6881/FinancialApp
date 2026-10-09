import { CalendarDays, ReceiptText } from 'lucide-react'
import type { DashboardData } from '../../types'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import { Panel } from '../ui/Panel'

interface CycleInsightsCardProps {
  insights: NonNullable<DashboardData['cycleSummaryInsights']>
  formatSensitive: (value: number) => React.ReactNode
  onSelectLargestExpense?: () => void
  hasLargestExpense?: boolean
}

export function CycleInsightsCard({
  insights,
  formatSensitive,
  onSelectLargestExpense,
  hasLargestExpense = Boolean(onSelectLargestExpense && insights.largestExpenseAmount != null),
}: CycleInsightsCardProps) {
  const canSelectExpense = Boolean(onSelectLargestExpense && hasLargestExpense && insights.largestExpenseAmount != null)

  return (
    <Panel as="section" aria-labelledby="cycle-insights-title">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground"><CalendarDays className="size-5" aria-hidden /></div>
        <div>
          <h2 id="cycle-insights-title" className="text-subsection text-foreground">This cycle at a glance</h2>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-control bg-surface-2/70 p-3.5"><dt className="text-label font-medium text-muted-foreground">Transactions</dt><dd className="mt-1 text-section text-foreground tabular-nums">{insights.transactionCount}</dd></div>
        <div className="rounded-control bg-surface-2/70 p-3.5"><dt className="text-label font-medium text-muted-foreground">No-spend days</dt><dd className="mt-1 text-section text-foreground tabular-nums">{insights.noSpendDays}</dd></div>
        <div className="rounded-control bg-surface-2/70 p-3.5"><dt className="text-label font-medium text-muted-foreground">Average per day</dt><dd className="mt-1 text-section text-foreground tabular-nums">{insights.avgDailySpend == null ? 'Unavailable' : formatSensitive(insights.avgDailySpend)}</dd></div>
        {/* The tile stays the same `<div>` its three neighbours are, so it lines up with them and
            `<dt>`/`<dd>` stay legal children of the list. The action is a full-bleed overlay --
            the same way a bill node on the timeline is made clickable -- rather than a button
            wrapped around the definition pair. */}
        <div className={cn('relative rounded-control bg-surface-2/70 p-3.5', canSelectExpense && 'group border border-transparent transition-colors focus-within:border-primary/40 hover:border-primary/40 hover:bg-surface-2')}>
          <dt className={cn('text-label font-medium text-muted-foreground', canSelectExpense && 'transition-colors group-hover:text-foreground')}>
            Biggest expense
          </dt>
          <dd className="mt-1 flex items-center gap-1.5 text-section text-foreground tabular-nums">
            <ReceiptText className={cn('size-3.5', canSelectExpense && 'text-muted-foreground')} aria-hidden />
            {insights.largestExpenseAmount == null ? 'None' : formatSensitive(Math.abs(insights.largestExpenseAmount))}
          </dd>
          {insights.largestExpenseDescription && (
            <p className="mt-1 truncate text-caption text-muted-foreground" title={insights.largestExpenseDescription}>
              {insights.largestExpenseDescription}
            </p>
          )}
          {canSelectExpense && (
            <Button
              variant="tertiary"
              type="button"
              onClick={onSelectLargestExpense}
              aria-label={`View biggest expense: ${insights.largestExpenseDescription || 'transaction'} in Ledger`}
              className="absolute inset-0 size-full rounded-xl p-0 hover:bg-transparent"
            />
          )}
        </div>
      </dl>
    </Panel>
  )
}
