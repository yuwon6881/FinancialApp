import type { ReactNode } from 'react'
import { Gift, Receipt } from 'lucide-react'
import type { buildCycleSummary } from '../../lib/cycleSummary'

type Summary = ReturnType<typeof buildCycleSummary>

export function CycleActivitySections({
  summary,
  formatSensitive,
}: {
  summary: Summary
  formatSensitive: (value: number) => ReactNode
}) {
  return (
    <>
      {summary.billsCount > 0 && (
        <Section title="Bills">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Receipt className="size-3.5 shrink-0 text-amber-500" />
                  <span className="text-xs font-bold text-foreground">
                    {summary.pendingCount === 0 ? 'All bills settled' : `${summary.paidBillsCount} of ${summary.billsCount} paid`}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
                  {summary.pendingCount === 0
                    ? `Completed ${summary.paidBillsCount} subscription bill${summary.paidBillsCount === 1 ? '' : 's'}`
                    : `${summary.pendingCount} bill${summary.pendingCount === 1 ? '' : 's'} pending (${formatSensitive(summary.pendingTotal)})`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-extrabold text-foreground block">{formatSensitive(summary.paidTotal)}</span>
                <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground block">Total paid</span>
              </div>
            </div>
            <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <StatusPill tone="emerald">{summary.paidBillsCount} Paid ({formatSensitive(summary.paidTotal)})</StatusPill>
                {summary.pendingCount > 0 && <StatusPill tone="amber">{summary.pendingCount} Pending ({formatSensitive(summary.pendingTotal)})</StatusPill>}
                {summary.discardedCount > 0 && <StatusPill tone="muted">{summary.discardedCount} Skipped</StatusPill>}
              </div>
            </div>
          </div>
        </Section>
      )}

      {summary.purchasedThisCycle.length > 0 && (
        <Section title="Wishlist purchases">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Gift className="size-3.5 shrink-0 text-pink-500" />
                  <span className="text-xs font-bold text-foreground">
                    {summary.purchasedThisCycle.length} {summary.purchasedThisCycle.length === 1 ? 'goal fulfilled' : 'goals fulfilled'}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground truncate">Achieved wishlist items for this cycle</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-extrabold text-foreground block">{formatSensitive(summary.purchasedTotal)}</span>
                <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground block">Total value</span>
              </div>
            </div>
            <div className="space-y-1.5 pt-1">
              {summary.purchasedThisCycle.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-[11px]">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-bold text-foreground truncate">{item.name}</span>
                    {item.priority && <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${priorityClass(item.priority)}`}>{item.priority}</span>}
                  </div>
                  <span className="shrink-0 font-bold text-foreground">{formatSensitive(item.price)}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}
    </>
  )
}

export function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return <section><h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{icon}{title}</h3>{children}</section>
}

function StatusPill({ tone, children }: { tone: 'emerald' | 'amber' | 'muted'; children: ReactNode }) {
  const classes = tone === 'emerald'
    ? 'bg-emerald-500/10 text-emerald-500'
    : tone === 'amber' ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'
  const dot = tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-muted-foreground'
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] ${classes}`}><span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{children}</span>
}

function priorityClass(priority: string) {
  return priority.toLowerCase() === 'high'
    ? 'bg-pink-500/10 text-pink-500'
    : priority.toLowerCase() === 'medium'
      ? 'bg-amber-500/10 text-amber-500'
      : 'bg-muted text-muted-foreground'
}
