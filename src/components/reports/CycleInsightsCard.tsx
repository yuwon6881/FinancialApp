import { CalendarDays, ReceiptText } from 'lucide-react'
import type { DashboardData } from '../../types'
import { Button } from '../ui/Button'
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
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500"><CalendarDays className="size-5" aria-hidden /></div>
        <div>
          <h2 id="cycle-insights-title" className="text-sm font-bold text-foreground">This cycle at a glance</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Useful patterns from the cycle you selected.</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-muted/25 p-3"><dt className="text-xs font-bold uppercase text-muted-foreground">Transactions</dt><dd className="mt-1 text-lg font-black text-foreground">{insights.transactionCount}</dd></div>
        <div className="rounded-xl bg-muted/25 p-3"><dt className="text-xs font-bold uppercase text-muted-foreground">No-spend days</dt><dd className="mt-1 text-lg font-black text-foreground">{insights.noSpendDays}</dd></div>
        <div className="rounded-xl bg-muted/25 p-3"><dt className="text-xs font-bold uppercase text-muted-foreground">Average per day</dt><dd className="mt-1 text-sm font-black text-foreground">{insights.avgDailySpend == null ? 'Unavailable' : formatSensitive(insights.avgDailySpend)}</dd></div>
        {canSelectExpense ? (
          <Button
            variant="unstyled"
            type="button"
            onClick={onSelectLargestExpense}
            aria-label={`View biggest expense: ${insights.largestExpenseDescription || 'transaction'} in Ledger`}
            className="group rounded-xl border border-transparent bg-muted/25 p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/35 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring cursor-pointer"
          >
            <dt className="text-xs font-bold uppercase text-muted-foreground group-hover:text-foreground transition-colors">
              Biggest expense
            </dt>
            <dd className="mt-1 flex items-center gap-1 text-sm font-black text-foreground">
              <ReceiptText className="size-3.5 text-orange-500" aria-hidden />
              {formatSensitive(Math.abs(insights.largestExpenseAmount!))}
            </dd>
            {insights.largestExpenseDescription && (
              <p className="mt-1 truncate text-xs text-muted-foreground" title={insights.largestExpenseDescription}>
                {insights.largestExpenseDescription}
              </p>
            )}
          </Button>
        ) : (
          <div className="rounded-xl bg-muted/25 p-3">
            <dt className="text-xs font-bold uppercase text-muted-foreground">Biggest expense</dt>
            <dd className="mt-1 flex items-center gap-1 text-sm font-black text-foreground">
              <ReceiptText className="size-3.5" aria-hidden />
              {insights.largestExpenseAmount == null ? 'None' : formatSensitive(Math.abs(insights.largestExpenseAmount))}
            </dd>
            {insights.largestExpenseDescription && (
              <p className="mt-1 truncate text-xs text-muted-foreground" title={insights.largestExpenseDescription}>
                {insights.largestExpenseDescription}
              </p>
            )}
          </div>
        )}
      </dl>
    </Panel>
  )
}
