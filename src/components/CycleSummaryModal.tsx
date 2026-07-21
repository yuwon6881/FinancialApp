import { useMemo, type ReactNode } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  FileBarChart,
  Gift,
  LoaderCircle,
  Receipt,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import type { DashboardData, WishlistItem } from '../types'
import { useAppContext } from '../contexts/AppContext'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import { buildCycleSummary, formatRate, formatRateChange } from '../lib/cycleSummary'
import { BottomSheet } from './ui/BottomSheet'

interface CycleSummaryModalProps {
  isOpen: boolean
  onClose: () => void
  data: DashboardData | null
  previousData: DashboardData | null
  isLoading: boolean
  loadError: string | null
  wishlist: WishlistItem[]
  monthIndex: number
  year: number
  cycleDay: number
  variant: 'auto' | 'manual'
  onViewLedger?: () => void
}

export function CycleSummaryModal({
  isOpen,
  onClose,
  data,
  previousData,
  isLoading,
  loadError,
  wishlist,
  monthIndex,
  year,
  cycleDay,
  variant,
  onViewLedger,
}: CycleSummaryModalProps) {
  const { formatSensitive } = useAppContext()
  const summary = useMemo(
    () => data ? buildCycleSummary(data, previousData, wishlist, year, monthIndex, cycleDay) : null,
    [data, previousData, wishlist, year, monthIndex, cycleDay],
  )

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-3xl"
      ariaLabel="Cycle summary"
      title={
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <ChartNoAxesCombined className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-foreground sm:text-base">
              {variant === 'auto' ? 'Your cycle wrapped up' : 'Cycle summary'}
            </div>
            {summary && <div className="truncate text-[11px] font-medium text-muted-foreground">{summary.cycleLabel}</div>}
          </div>
        </div>
      }
      footer={
        <div className="flex gap-2 sm:justify-end">
          {onViewLedger && summary?.hasActivity && (
            <button onClick={onViewLedger} className="flex-1 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted/70 sm:flex-none">
              View ledger
            </button>
          )}
          <button onClick={onClose} className="flex-1 rounded-lg bg-foreground px-4 py-2 text-xs font-bold text-background transition hover:bg-foreground/90 sm:flex-none">
            {variant === 'auto' ? 'Got it' : 'Close'}
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center text-xs text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin text-blue-500" />
          Loading cycle summary…
        </div>
      ) : !summary ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
            <FileBarChart className="size-6" />
          </span>
          <h3 className="mt-4 text-sm font-bold text-foreground">Summary unavailable</h3>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            {loadError || 'Could not load this cycle. Please close the summary and try again.'}
          </p>
        </div>
      ) : !summary.hasActivity ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <FileBarChart className="size-6" />
          </span>
          <h3 className="mt-4 text-sm font-bold text-foreground">No activity recorded</h3>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            This cycle has no inflows, expenses, paid bills, or wishlist purchases to summarize.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-[1.25fr_1fr]">
            <div className={`rounded-2xl border p-4 sm:p-5 ${summary.positive ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-orange-500/20 bg-orange-500/5'}`}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {summary.positive ? <TrendingUp className="size-3.5 text-emerald-500" /> : <TrendingDown className="size-3.5 text-orange-500" />}
                Net cash flow
              </div>
              <div className={`mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl ${summary.positive ? 'text-emerald-500' : 'text-orange-500'}`}>
                {summary.net < 0 ? '−' : '+'}{formatSensitive(Math.abs(summary.net))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{summary.positive ? 'Left after spending' : 'Spent beyond inflow'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
              <StatTile icon={<ArrowDownRight className="size-3.5 text-emerald-500" />} label="In" value={formatSensitive(summary.inflow)} />
              <StatTile icon={<ArrowUpRight className="size-3.5 text-orange-500" />} label="Out" value={formatSensitive(summary.expenses)} />
            </div>
          </div>

          {summary.previousHasActivity && (
            <Section title="Since last cycle">
              <div className="grid gap-3 sm:grid-cols-2">
                {summary.spendingDelta !== null && (
                  <InsightCard
                    title="Spending"
                    value={formatSensitive(Math.abs(summary.spendingDelta))}
                    tone={summary.spendingDelta <= 0 ? 'good' : 'warn'}
                    detail={summary.spendingDelta <= 0 ? 'less than last cycle' : 'more than last cycle'}
                  />
                )}
                {summary.savingsRate !== null && (
                  <InsightCard
                    title="Savings rate"
                    value={formatRate(summary.savingsRate)}
                    tone={summary.savingsRate >= 0 ? 'good' : 'warn'}
                    detail={summary.previousSavingsRate === null ? 'this cycle' : formatRateChange(summary.savingsRate - summary.previousSavingsRate)}
                  />
                )}
                {summary.biggestCategoryShift && (
                  <InsightCard
                    title="Biggest shift"
                    value={summary.biggestCategoryShift.category}
                    tone={summary.biggestCategoryShift.delta <= 0 ? 'good' : 'warn'}
                    detail={`${formatSensitive(Math.abs(summary.biggestCategoryShift.delta))} ${summary.biggestCategoryShift.delta <= 0 ? 'less' : 'more'} spent`}
                  />
                )}
                {summary.growthDelta !== null && (
                  <InsightCard
                    title="Growth fund"
                    value={`${summary.growthDelta < 0 ? '−' : '+'}${formatSensitive(Math.abs(summary.growthDelta))}`}
                    tone={summary.growthDelta >= 0 ? 'good' : 'warn'}
                    detail="ending balance"
                  />
                )}
              </div>
            </Section>
          )}

          <Section title="Envelopes">
            <div className="grid gap-3 sm:grid-cols-2">
              {summary.envelopes.map(envelope => (
                <div key={envelope.name} className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-foreground">{envelope.name}</span>
                    <span className={`text-xs font-bold ${envelope.overspent ? 'text-orange-500' : 'text-foreground'}`}>
                      <span className="mr-1 font-medium text-muted-foreground">Spent</span>{formatSensitive(envelope.spent)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Balance</span>
                    <span className={envelope.overspent ? 'font-bold text-orange-500' : ''}>{formatSensitive(envelope.remaining)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid gap-6 sm:grid-cols-2">
            {summary.topCategories.length > 0 && (
              <Section title="Where it went">
                <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3.5">
                  {summary.topCategories.map(category => (
                    <div key={category.category} className="grid grid-cols-[minmax(0,6.5rem)_minmax(2.5rem,1fr)_auto] items-center gap-2">
                      <span className={`truncate rounded border px-1.5 py-0.5 text-[9px] font-bold ${getCategoryBadgeClass(category.category)}`}>{category.category}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-foreground/40" style={{ width: `${summary.topMax > 0 ? (category.amount / summary.topMax) * 100 : 0}%` }} />
                      </div>
                      <span className="shrink-0 text-[11px] font-bold text-foreground">{formatSensitive(category.amount)}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {summary.stabilityTarget > 0 && (
              <Section title="Stability fund">
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">Funded</span>
                    <span className="font-bold text-foreground">{Math.round(summary.stabilityPct * 100)}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${summary.stabilityPct * 100}%` }} /></div>
                </div>
              </Section>
            )}
          </div>

          {(summary.billsCount > 0 || summary.purchasedThisCycle.length > 0) && (
            <div className="grid gap-6 sm:grid-cols-2">
              {summary.billsCount > 0 && (
                <Section title="Bills">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 p-3">
                    <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground"><Receipt className="size-3.5 shrink-0 text-amber-500" />{summary.paidBillsCount} paid · {summary.pendingCount} pending{summary.discardedCount > 0 ? ` · ${summary.discardedCount} skipped` : ''}</span>
                    <span className="shrink-0 text-xs font-bold text-foreground">{formatSensitive(summary.paidTotal)}</span>
                  </div>
                </Section>
              )}
              {summary.purchasedThisCycle.length > 0 && (
                <Section title="Wishlist purchases">
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-semibold text-foreground"><Gift className="size-3.5 text-pink-500" />{summary.purchasedThisCycle.length} purchased</span><span className="font-bold text-foreground">{formatSensitive(summary.purchasedTotal)}</span></div>
                    <div className="space-y-1.5">
                      {summary.purchasedThisCycle.map(item => <div key={item.id} className="flex items-center justify-between gap-3 text-[11px]"><span className="truncate text-muted-foreground">{item.name}</span><span className="shrink-0 font-semibold text-foreground">{formatSensitive(item.price)}</span></div>)}
                    </div>
                  </div>
                </Section>
              )}
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  )
}

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return <div className="flex min-w-0 flex-col items-center justify-center rounded-xl border border-border/50 bg-muted/20 px-2 py-2.5 sm:flex-row sm:justify-between sm:px-3"><div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground sm:text-[10px]">{icon}{label}</div><div className="mt-1 max-w-full truncate text-xs font-bold text-foreground sm:mt-0 sm:text-sm">{value}</div></div>
}

function InsightCard({ title, value, detail, tone }: { title: string; value: ReactNode; detail: string; tone: 'good' | 'warn' }) {
  return <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5"><div className="flex items-start justify-between gap-3"><span className="text-[11px] font-semibold text-muted-foreground">{title}</span><span className={`max-w-[55%] truncate text-right text-xs font-bold ${tone === 'good' ? 'text-emerald-500' : 'text-orange-500'}`}>{value}</span></div><p className="mt-1.5 text-[10px] text-foreground/70">{detail}</p></div>
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return <section><h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{icon}{title}</h3>{children}</section>
}
