import { CalendarDays, ReceiptText } from 'lucide-react'
import type { DashboardData } from '../../types'

interface CycleInsightsCardProps {
  insights: NonNullable<DashboardData['cycleSummaryInsights']>
  formatSensitive: (value: number) => React.ReactNode
}

export function CycleInsightsCard({ insights, formatSensitive }: CycleInsightsCardProps) {
  return (
    <section aria-labelledby="cycle-insights-title" className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500"><CalendarDays className="size-5" aria-hidden /></div>
        <div>
          <h2 id="cycle-insights-title" className="text-sm font-bold text-foreground">This cycle at a glance</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Useful patterns from the cycle you selected.</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-muted/25 p-3"><dt className="text-[10px] font-bold uppercase text-muted-foreground">Transactions</dt><dd className="mt-1 text-lg font-black text-foreground">{insights.transactionCount}</dd></div>
        <div className="rounded-xl bg-muted/25 p-3"><dt className="text-[10px] font-bold uppercase text-muted-foreground">No-spend days</dt><dd className="mt-1 text-lg font-black text-foreground">{insights.noSpendDays}</dd></div>
        <div className="rounded-xl bg-muted/25 p-3"><dt className="text-[10px] font-bold uppercase text-muted-foreground">Average per day</dt><dd className="mt-1 text-sm font-black text-foreground">{insights.avgDailySpend == null ? 'Unavailable' : formatSensitive(insights.avgDailySpend)}</dd></div>
        <div className="rounded-xl bg-muted/25 p-3"><dt className="text-[10px] font-bold uppercase text-muted-foreground">Biggest expense</dt><dd className="mt-1 flex items-center gap-1 text-sm font-black text-foreground"><ReceiptText className="size-3.5" aria-hidden />{insights.largestExpenseAmount == null ? 'None' : formatSensitive(Math.abs(insights.largestExpenseAmount))}</dd>{insights.largestExpenseDescription && <p className="mt-1 truncate text-[10px] text-muted-foreground">{insights.largestExpenseDescription}</p>}</div>
      </dl>
    </section>
  )
}
