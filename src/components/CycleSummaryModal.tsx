import { useMemo, type ReactNode } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  PiggyBank,
  Receipt,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import type { DashboardData, WishlistItem } from '../types'
import { useAppContext } from '../contexts/AppContext'
import { getCycleRangeDates } from '../lib/cycle'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import { BottomSheet } from './ui/BottomSheet'

interface CycleSummaryModalProps {
  isOpen: boolean
  onClose: () => void
  // Full dashboard payload for the cycle being summarized. For the currently selected cycle this
  // is the live (optimistic) data, so edits made while viewing the cycle are reflected instantly.
  data: DashboardData | null
  wishlist: WishlistItem[]
  monthIndex: number // 1-12, the cycle's anchor month
  year: number
  cycleDay: number
  // "auto" = fired once on entering a new cycle; "manual" = re-opened from Reports.
  variant: 'auto' | 'manual'
  onViewLedger?: () => void
}

const ENVELOPES = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const

export function CycleSummaryModal({
  isOpen,
  onClose,
  data,
  wishlist,
  monthIndex,
  year,
  cycleDay,
  variant,
  onViewLedger,
}: CycleSummaryModalProps) {
  const { formatSensitive } = useAppContext()

  const summary = useMemo(() => {
    if (!data) return null

    const income = data.stats.monthlyIncome
    const inflow = data.stats.monthlyInflow
    const expenses = data.stats.monthlyExpenses
    const net = inflow - expenses

    // Growth-balance trajectory vs the prior cycle, taken from the trend series (the last point is
    // this cycle, the one before it is the previous cycle). Only shown when both points exist.
    const trend = data.trendPoints || []
    const growthNow = trend.length >= 1 ? trend[trend.length - 1].balance : null
    const growthPrev = trend.length >= 2 ? trend[trend.length - 2].balance : null
    const growthDelta = growthNow !== null && growthPrev !== null ? growthNow - growthPrev : null

    const envelopes = ENVELOPES.map(name => {
      const cat = data.categories.find(c => c.name === name)
      const budget = cat?.budget ?? 0
      const target = cat?.target ?? 0
      const netChange = cat?.netChange ?? 0
      const remaining = cat?.remaining ?? 0
      const spent = netChange < 0 ? -netChange : 0
      const available = budget + target
      return { name, budget, target, netChange, remaining, spent, available, overspent: remaining < -0.005 }
    })

    const stabilityPct = Math.max(0, Math.min(1, data.stats.stabilityPercentReached))

    const topCategories = (data.monthlyCategoryBreakdown || [])
      .filter(c => c.amount > 0)
      .slice(0, 5)
    const topMax = topCategories.reduce((max, c) => Math.max(max, c.amount), 0)

    const bills = data.activeRecurringPayments || []
    const paidBills = bills.filter(b => b.status === 'Paid')
    const paidTotal = paidBills.reduce((sum, b) => sum + Math.abs(b.amount), 0)
    const pendingCount = bills.filter(b => b.status === 'Pending').length
    const discardedCount = bills.filter(b => b.status === 'Discarded').length

    // Wishlist items purchased within this cycle's date range.
    const { start, end } = getCycleRangeDates(year, monthIndex, cycleDay)
    const purchasedThisCycle = (wishlist || []).filter(item => {
      if (!item.isPurchased || !item.purchasedAt) return false
      const at = new Date(item.purchasedAt)
      return at >= start && at <= end
    })
    const purchasedTotal = purchasedThisCycle.reduce((sum, item) => sum + item.price, 0)

    return {
      income,
      inflow,
      expenses,
      net,
      positive: net >= 0,
      growthDelta,
      envelopes,
      stabilityPct,
      stabilityTarget: data.setting.targetStabilityFund,
      topCategories,
      topMax,
      paidBillsCount: paidBills.length,
      paidTotal,
      pendingCount,
      discardedCount,
      purchasedThisCycle,
      purchasedTotal,
      cycleLabel: data.cycleLabel,
    }
  }, [data, wishlist, monthIndex, year, cycleDay])

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      ariaLabel="End of cycle summary"
      title={
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet-500" />
          <div className="flex flex-col">
            <span className="text-base font-bold text-foreground">
              {variant === 'auto' ? 'Your cycle just wrapped up' : 'Cycle summary'}
            </span>
            {summary && <span className="text-[11px] font-medium text-muted-foreground">{summary.cycleLabel}</span>}
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {onViewLedger && (
            <button
              onClick={onViewLedger}
              className="w-full sm:w-auto rounded-xl border border-border/60 bg-muted/40 px-4 py-2 text-xs font-bold text-foreground transition hover:bg-muted/70 cursor-pointer"
            >
              View full ledger
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl bg-foreground px-4 py-2 text-xs font-bold text-background shadow-sm transition hover:bg-foreground/90 cursor-pointer"
          >
            {variant === 'auto' ? 'Got it' : 'Close'}
          </button>
        </div>
      }
    >
      {!summary ? (
        <div className="flex min-h-56 items-center justify-center p-8 text-center text-xs text-muted-foreground">
          No data for this cycle yet.
        </div>
      ) : (
        <div className="space-y-5">
          {/* Hero: net result for the cycle */}
          <div
            className={`rounded-2xl border p-5 text-center ${
              summary.positive
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-orange-500/20 bg-orange-500/5'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {summary.positive ? (
                <TrendingUp className="size-3.5 text-emerald-500" />
              ) : (
                <TrendingDown className="size-3.5 text-orange-500" />
              )}
              {summary.positive ? 'You came out ahead' : 'You spent more than you took in'}
            </div>
            <div
              className={`mt-1.5 text-3xl font-extrabold tracking-tight ${
                summary.positive ? 'text-emerald-500' : 'text-orange-500'
              }`}
            >
              {formatSensitive(Math.abs(summary.net))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {summary.positive ? 'net saved this cycle' : 'net overspend this cycle'}
            </p>
          </div>

          {/* Cash flow tiles */}
          <div className="grid grid-cols-3 gap-2">
            <StatTile
              icon={<ArrowDownRight className="size-3.5 text-emerald-500" />}
              label="In"
              value={formatSensitive(summary.inflow)}
            />
            <StatTile
              icon={<ArrowUpRight className="size-3.5 text-orange-500" />}
              label="Out"
              value={formatSensitive(summary.expenses)}
            />
            <StatTile
              icon={<Wallet className="size-3.5 text-blue-500" />}
              label="Income"
              value={formatSensitive(summary.income)}
            />
          </div>

          {summary.growthDelta !== null && (
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 px-4 py-2.5">
              <span className="text-xs font-semibold text-foreground">Growth balance vs last cycle</span>
              <span
                className={`flex items-center gap-1 text-xs font-bold ${
                  summary.growthDelta >= 0 ? 'text-emerald-500' : 'text-orange-500'
                }`}
              >
                {summary.growthDelta >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {summary.growthDelta >= 0 ? '+' : '-'}
                {formatSensitive(Math.abs(summary.growthDelta))}
              </span>
            </div>
          )}

          {/* Budget envelopes */}
          <Section title="Budget envelopes">
            <div className="space-y-2">
              {summary.envelopes.map(env => (
                <div key={env.name} className="rounded-xl border border-border/50 bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{env.name}</span>
                    <span
                      className={`text-xs font-bold ${env.overspent ? 'text-orange-500' : 'text-foreground'}`}
                    >
                      {formatSensitive(env.remaining)}
                      <span className="ml-1 text-[10px] font-medium text-muted-foreground">left</span>
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Spent {formatSensitive(env.spent)}</span>
                    {env.overspent && (
                      <span className="font-bold text-orange-500">Over budget</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Stability fund progress */}
          {summary.stabilityTarget > 0 && (
            <Section title="Stability fund">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    <PiggyBank className="size-3.5 text-cyan-500" />
                    Target reached
                  </span>
                  <span className="font-bold text-foreground">{Math.round(summary.stabilityPct * 100)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-cyan-500 transition-all"
                    style={{ width: `${Math.min(100, summary.stabilityPct * 100)}%` }}
                  />
                </div>
              </div>
            </Section>
          )}

          {/* Top spending categories */}
          {summary.topCategories.length > 0 && (
            <Section title="Where it went">
              <div className="space-y-1.5">
                {summary.topCategories.map(cat => (
                  <div key={cat.category} className="flex items-center gap-2">
                    <span
                      className={`inline-block shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold ${getCategoryBadgeClass(cat.category)}`}
                    >
                      {cat.category}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/40"
                        style={{ width: `${summary.topMax > 0 ? (cat.amount / summary.topMax) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] font-bold text-foreground">
                      {formatSensitive(cat.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Bills */}
          <Section title="Bills this cycle">
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Receipt className="size-3.5 text-amber-500" />
                {summary.paidBillsCount} paid
                {summary.pendingCount > 0 && (
                  <span className="text-muted-foreground">· {summary.pendingCount} pending</span>
                )}
                {summary.discardedCount > 0 && (
                  <span className="text-muted-foreground">· {summary.discardedCount} skipped</span>
                )}
              </span>
              <span className="text-xs font-bold text-foreground">{formatSensitive(summary.paidTotal)}</span>
            </div>
          </Section>

          {/* Wishlist purchases */}
          {summary.purchasedThisCycle.length > 0 && (
            <Section title="Wishlist purchases">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <ShoppingBag className="size-3.5 text-pink-500" />
                    {summary.purchasedThisCycle.length} item{summary.purchasedThisCycle.length === 1 ? '' : 's'}
                  </span>
                  <span className="text-xs font-bold text-foreground">{formatSensitive(summary.purchasedTotal)}</span>
                </div>
                <div className="space-y-1">
                  {summary.purchasedThisCycle.map(item => (
                    <div key={item.id} className="flex items-center justify-between text-[11px]">
                      <span className="truncate text-muted-foreground">{item.name}</span>
                      <span className="shrink-0 font-semibold text-foreground">{formatSensitive(item.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}
        </div>
      )}
    </BottomSheet>
  )
}

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-bold text-foreground">{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  )
}
