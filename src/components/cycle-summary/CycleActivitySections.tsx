import type { ReactNode } from 'react'
import { FastForward, Landmark, Receipt } from 'lucide-react'
import { RewardIcon } from '../semanticIcons'
import type { buildCycleSummary } from '../../lib/cycleSummary'
import { Meter } from '../ui/Meter'

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
      {summary.loanActivity.length > 0 && (
        <Section title="Loan progress">
          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Landmark className="size-3.5 shrink-0 text-blue-500" aria-hidden />
                  <span className="text-xs font-bold text-foreground">Paid toward loans</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {summary.loanPaymentCount} ledger {summary.loanPaymentCount === 1 ? 'payment' : 'payments'} across {summary.loanActivity.length} {summary.loanActivity.length === 1 ? 'loan' : 'loans'}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="block text-xs font-extrabold text-foreground">{formatSensitive(summary.loanPaymentTotal)}</span>
                <span className="block text-eyebrow uppercase text-muted-foreground">Total paid</span>
              </div>
            </div>

            {(summary.loanPaidAheadCount > 0 || summary.loansPaidOffCount > 0) && (
              <div className="flex flex-wrap gap-1.5 border-t border-border/40 pt-2">
                {summary.loanPaidAheadCount > 0 && (
                  <StatusPill tone="blue">
                    <FastForward className="size-3" aria-hidden />
                    {summary.loanPaidAheadCount} paid ahead ({formatSensitive(summary.loanPaidAheadTotal)})
                  </StatusPill>
                )}
                {summary.loansPaidOffCount > 0 && (
                  <StatusPill tone="emerald">{summary.loansPaidOffCount} paid off</StatusPill>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              {summary.loanActivity.map(loan => (
                <div key={loan.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">{loan.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {loan.paymentCount} {loan.paymentCount === 1 ? 'payment' : 'payments'}
                      {loan.paidAheadCount > 0 ? ` · ${loan.paidAheadCount} ahead of schedule` : ''}
                      {loan.paidOffThisCycle ? ' · Paid off' : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-foreground">{formatSensitive(loan.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {summary.billsCount > 0 && (
        <Section title="Bills">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Receipt className="size-3.5 shrink-0 text-amber-500" />
                  <span className="text-xs font-bold text-foreground">
                    {summary.outstandingCount === 0
                      ? 'No bills left open'
                      : `${summary.outstandingCount} ${summary.outstandingCount === 1 ? 'bill' : 'bills'} still open`}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {summary.outstandingCount === 0
                    ? `${summary.clearedBillsCount} cleared${summary.discardedCount > 0 ? ` · ${summary.discardedCount} skipped` : ''}`
                    : `${formatSensitive(summary.outstandingTotal)} left to pay across open bills`}
                </p>
                {/* The pills describe the bill counts above, so they sit with them rather than in a
                    separate ruled row where a single pill dangled under a full-width border. */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs empty:hidden">
                  {summary.paidBillsCount > 0 && <StatusPill tone="emerald">{summary.paidBillsCount} Paid</StatusPill>}
                  {summary.partPaidCount > 0 && <StatusPill tone="blue">{summary.partPaidCount} Part paid</StatusPill>}
                  {summary.outstandingCount - summary.partPaidCount > 0 && <StatusPill tone="amber">{summary.outstandingCount - summary.partPaidCount} Pending</StatusPill>}
                  {summary.paidOffBillsCount > 0 && <StatusPill tone="emerald">{summary.paidOffBillsCount} Paid off</StatusPill>}
                  {summary.discardedCount > 0 && <StatusPill tone="muted">{summary.discardedCount} Skipped</StatusPill>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="block text-xs font-extrabold text-foreground">{formatSensitive(summary.paidTotal)}</span>
                <span className="block text-eyebrow uppercase text-muted-foreground">Recorded paid</span>
              </div>
            </div>
          </div>
        </Section>
      )}

      {summary.purchasedThisCycle.length > 0 && (
        <Section title="Claimed rewards">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <RewardIcon className="size-3.5 shrink-0 text-pink-500" aria-hidden />
                  <span className="text-xs font-bold text-foreground">
                    {summary.purchasedThisCycle.length} {summary.purchasedThisCycle.length === 1 ? 'reward claimed' : 'rewards claimed'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground truncate">Rewards claimed during this cycle</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-extrabold text-foreground block">{formatSensitive(summary.purchasedTotal)}</span>
                <span className="text-eyebrow uppercase text-muted-foreground block">Total value</span>
              </div>
            </div>
            <div className="space-y-1.5 pt-1">
              {summary.purchasedThisCycle.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-xs">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-bold text-foreground truncate">{item.name}</span>
                    {item.priority && <span className={`shrink-0 rounded px-1.5 py-0.5 text-eyebrow uppercase ${priorityClass(item.priority)}`}>{item.priority}</span>}
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

/**
 * The stability card renders from two places in the modal -- the layout branches on whether there
 * is a "Where it went" chart to sit beside -- so it lives in one component rather than as two
 * copies that can drift apart.
 */
export function StabilityFundSection({
  summary,
  formatSensitive,
  hideSensitive,
}: {
  summary: Summary
  formatSensitive: (value: number) => ReactNode
  hideSensitive?: boolean
}) {
  return (
    <Section title="Stability fund">
      <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">Funded</span>
          <span className="font-bold text-foreground">{Math.round(summary.stabilityPct * 100)}%</span>
        </div>
        <Meter className="mt-2 h-2" percent={summary.stabilityPct * 100} tone="bg-cyan-500" valueHidden={hideSensitive} label="Stability fund funded against its target" />
        {/* The percentage on its own never said how much money that was, nor how much of the
            target is still to go -- the two figures the fund is actually about. */}
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{formatSensitive(summary.stabilityBalance)} of {formatSensitive(summary.stabilityTarget)}</span>
          <span className="shrink-0 font-semibold">
            {summary.stabilityBalance >= summary.stabilityTarget
              ? 'Target reached'
              : <>{formatSensitive(summary.stabilityTarget - summary.stabilityBalance)} to go</>}
          </span>
        </div>
      </div>
    </Section>
  )
}

export function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return <section><h3 className="mb-3 flex items-center gap-1.5 text-eyebrow uppercase text-muted-foreground">{icon}{title}</h3>{children}</section>
}

function StatusPill({ tone, children }: { tone: 'emerald' | 'amber' | 'blue' | 'muted'; children: ReactNode }) {
  const classes = tone === 'emerald'
    ? 'bg-emerald-500/10 text-emerald-500'
    : tone === 'amber'
      ? 'bg-amber-500/10 text-amber-500'
      : tone === 'blue'
        ? 'bg-blue-500/10 text-blue-500'
        : 'bg-muted text-muted-foreground'
  const dot = tone === 'emerald'
    ? 'bg-emerald-500'
    : tone === 'amber'
      ? 'bg-amber-500'
      : tone === 'blue'
        ? 'bg-blue-500'
        : 'bg-muted-foreground'
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-xs ${classes}`}><span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{children}</span>
}

function priorityClass(priority: string) {
  return priority.toLowerCase() === 'high'
    ? 'bg-pink-500/10 text-pink-500'
    : priority.toLowerCase() === 'medium'
      ? 'bg-amber-500/10 text-amber-500'
      : 'bg-muted text-muted-foreground'
}
