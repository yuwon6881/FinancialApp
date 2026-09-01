import { useMemo, useRef } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  FileBarChart,
  Gauge,
  LoaderCircle,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react'
import type { DashboardData, Loan, Transaction, WishlistItem } from '../types'
import { useAppPrefs } from '../contexts/AppContext'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import { buildCycleSummary, formatRate, savingsRatePointChange } from '../lib/cycleSummary'
import { BottomSheet } from './ui/BottomSheet'
import { Button } from './ui/Button'
import { InfoHint } from './ui/InfoHint'
import { CycleActivitySections, Section, StabilityFundSection } from './cycle-summary/CycleActivitySections'
import { InsightCard, StatTile } from './cycle-summary/CycleSummaryCards'
import { changeTone } from '../lib/cycleSummaryTone'

interface CycleSummaryModalProps {
  isOpen: boolean
  onClose: () => void
  data: DashboardData | null
  previousData: DashboardData | null
  isLoading: boolean
  loadError: string | null
  wishlist: WishlistItem[]
  transactions?: Transaction[]
  loans?: Loan[]
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
  transactions,
  loans = [],
  monthIndex,
  year,
  cycleDay,
  variant,
  onViewLedger,
}: CycleSummaryModalProps) {
  const { formatSensitive } = useAppPrefs()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const summary = useMemo(
    () => data ? buildCycleSummary(data, previousData, wishlist, year, monthIndex, cycleDay, transactions, loans) : null,
    [data, previousData, wishlist, year, monthIndex, cycleDay, transactions, loans],
  )

  const savingsRateChange = savingsRatePointChange(summary?.savingsRate ?? null, summary?.previousSavingsRate ?? null)

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-3xl"
      initialFocusRef={closeButtonRef}
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
            {summary && <div className="truncate text-xs font-medium text-muted-foreground">{summary.cycleLabel}</div>}
          </div>
        </div>
      }
      footer={
        <div className="flex gap-2 sm:justify-end">
          {onViewLedger && summary?.hasActivity && (
            <Button variant="unstyled" onClick={onViewLedger} className="flex-1 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted/70 sm:flex-none">
              View ledger
            </Button>
          )}
          <Button ref={closeButtonRef} variant="unstyled" onClick={onClose} className="flex-1 rounded-lg bg-foreground px-4 py-2 text-xs font-bold text-background transition hover:bg-foreground/90 sm:flex-none">
            {variant === 'auto' ? 'Got it' : 'Close'}
          </Button>
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
            This cycle has no cash activity, bill updates, or claimed rewards to summarize.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-[1.25fr_1fr]">
            <div className={`rounded-2xl border p-4 sm:p-5 ${summary.positive ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-orange-500/20 bg-orange-500/5'}`}>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {summary.positive ? <TrendingUp className="size-3.5 text-emerald-500" /> : <TrendingDown className="size-3.5 text-orange-500" />}
                Net cash flow
              </div>
              <div className={`mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl ${summary.positive ? 'text-emerald-500' : 'text-orange-500'}`}>
                {summary.net < 0 ? '−' : '+'}{formatSensitive(Math.abs(summary.net))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{summary.positive ? 'Left after spending' : 'Spent beyond inflow'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
              <StatTile icon={<ArrowDownRight className="size-3.5 text-emerald-500" />} label="In" value={formatSensitive(summary.inflow)} />
              <StatTile icon={<ArrowUpRight className="size-3.5 text-orange-500" />} label="Out" value={formatSensitive(summary.expenses)} />
              {/* Only when it differs from total inflow: the savings rate divides by income, not
                  by everything that came in, and with refunds or transfers in the mix the two
                  figures disagree. Showing just "In" left that rate impossible to reconcile. */}
              {Math.abs(summary.income - summary.inflow) > 0.005 && (
                <StatTile icon={<Wallet className="size-3.5 text-blue-500" />} label="Income" value={formatSensitive(summary.income)} />
              )}
            </div>
          </div>



          <Section title="Envelopes">
            <div className="grid gap-3 sm:grid-cols-2">
              {summary.envelopes.map(envelope => (
                <div key={envelope.name} className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground">{envelope.name}</span>
                    {envelope.overspent && (
                      <span className="shrink-0 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-orange-500">
                        Overspent
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-0.5 rounded-lg bg-muted/40 px-2.5 py-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Allocated</span>
                      <span className="truncate text-xs font-bold text-foreground">{formatSensitive(envelope.allocated)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 rounded-lg bg-muted/40 px-2.5 py-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spent</span>
                      <span className={`text-xs font-bold ${envelope.overspent ? 'text-orange-500' : 'text-foreground'}`}>
                        {formatSensitive(envelope.spent)}
                      </span>
                    </div>
                    <div className={`flex flex-col gap-0.5 rounded-lg px-2.5 py-2 ${
                      envelope.overspent
                        ? 'bg-orange-500/10'
                        : envelope.remaining > 0
                          ? 'bg-emerald-500/10'
                          : 'bg-muted/40'
                    }`}>
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Carry forward</span>
                      <span className={`text-xs font-bold ${
                        envelope.overspent
                          ? 'text-orange-500'
                          : envelope.remaining > 0
                            ? 'text-emerald-400'
                            : 'text-muted-foreground'
                      }`}>
                        {formatSensitive(envelope.remaining)}
                      </span>
                    </div>
                  </div>
                  {envelope.accounts.length > 0 && (
                    <div className="mt-3 border-t border-border/40 pt-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accounts at cycle close</span>
                        <InfoHint label={`${envelope.name} account balances`} text="These account balances add up to the bucket's carry-forward amount at the end of this cycle." />
                      </div>
                      <div className="space-y-1.5">
                        {envelope.accounts.map(account => (
                          <div key={account.id} className="flex items-center justify-between gap-3 text-xs">
                            <span className="min-w-0 truncate text-muted-foreground">
                              {account.name}
                              {account.isArchived ? ' · Archived' : ''}
                            </span>
                            <span className="shrink-0 font-bold text-foreground">{formatSensitive(account.remaining)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {summary.categoryLimits.length > 0 && (
            <Section title="Cycle spending guides" icon={<Gauge className="size-3 text-blue-500" />}>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                <div className="mb-3 flex items-center justify-between gap-3 border-b border-border/40 pb-3">
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      {summary.categoryLimitsMet} of {summary.categoryLimits.length} within guide
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Final category spending for this salary cycle.</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-bold uppercase tracking-wide ${summary.categoryLimitsMet === summary.categoryLimits.length ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'}`}>
                    {summary.categoryLimitsMet === summary.categoryLimits.length ? 'All met' : `${summary.categoryLimits.length - summary.categoryLimitsMet} over`}
                  </span>
                </div>

                <div className="space-y-3">
                  {summary.categoryLimits.map(limit => {
                    const exceeded = limit.spent > limit.limit
                    return (
                      <div key={limit.category}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`max-w-32 truncate rounded border px-1.5 py-0.5 text-xs font-bold ${getCategoryBadgeClass(limit.category)}`}>
                            {limit.category}
                          </span>
                          <span className={`text-xs font-bold ${exceeded ? 'text-orange-500' : 'text-foreground'}`}>
                            {exceeded
                              ? <>{formatSensitive(Math.abs(limit.remaining))} over</>
                              : <>{formatSensitive(limit.remaining)} left</>}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${exceeded ? 'bg-orange-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(100, Math.max(0, limit.percentUsed * 100))}%` }}
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatSensitive(limit.spent)} spent</span>
                          <span>{formatSensitive(limit.limit)} guide</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Section>
          )}

          {summary.previousHasActivity && (
            <Section title="Since last cycle">
              <div className="grid gap-3 sm:grid-cols-2">
                {summary.spendingDelta !== null && (
                  <InsightCard
                    title="Spending"
                    value={formatSensitive(Math.abs(summary.spendingDelta))}
                    tone={changeTone(summary.spendingDelta, false)}
                    trendUp={summary.spendingDelta === 0 ? undefined : summary.spendingDelta > 0}
                    detail={summary.spendingDelta === 0
                      ? 'Same as last cycle'
                      : summary.spendingDelta < 0 ? 'Less than last cycle' : 'More than last cycle'}
                  />
                )}
                {summary.savingsRate !== null && (
                  <InsightCard
                    title="Savings rate"
                    value={formatRate(summary.savingsRate)}
                    // This card sits under "Since last cycle", so it reports a *change* -- but its
                    // tone was an absolute threshold. A rate that fell from 40% to 20% still cleared
                    // 10%, so it was painted green beside a down arrow and the words "Was 40% last
                    // cycle". Direction decides the colour whenever there is a previous cycle to
                    // have moved from; the threshold is only the fallback when there is not.
                    tone={savingsRateChange === null
                      ? (summary.savingsRate >= 0.1 ? 'good' : 'warn')
                      : changeTone(savingsRateChange, true)}
                    trendUp={savingsRateChange === null || savingsRateChange === 0
                      ? undefined
                      : savingsRateChange > 0}
                    detail={savingsRateChange === null
                      ? `${formatRate(summary.savingsRate)} of income saved this cycle`
                      : savingsRateChange === 0
                        ? `Same as last cycle (${formatRate(summary.savingsRate)})`
                        : `Was ${formatRate(summary.previousSavingsRate ?? 0)} last cycle`}
                    tooltipHint="Savings rate = (Income − Spending) ÷ Income"
                  />
                )}
                {summary.biggestCategoryShift && (
                  <InsightCard
                    title="Biggest shift"
                    value={summary.biggestCategoryShift.category}
                    tone={changeTone(summary.biggestCategoryShift.delta, false)}
                    trendUp={summary.biggestCategoryShift.delta === 0
                      ? undefined
                      : summary.biggestCategoryShift.delta > 0}
                    detail={`${formatSensitive(Math.abs(summary.biggestCategoryShift.delta))} ${summary.biggestCategoryShift.delta <= 0 ? 'less' : 'more'} spent`}
                  />
                )}
                {summary.growthDelta !== null && (
                  <InsightCard
                    title="Growth fund"
                    value={`${summary.growthDelta < 0 ? '−' : '+'}${formatSensitive(Math.abs(summary.growthDelta))}`}
                    tone={changeTone(summary.growthDelta, true)}
                    trendUp={summary.growthDelta === 0 ? undefined : summary.growthDelta > 0}
                    // The value is the movement between the two cycles. The old line called it
                    // the ending balance, which named a different number entirely.
                    detail={summary.growthEnding === null
                      ? (summary.growthDelta === 0 ? 'Same as last cycle' : summary.growthDelta > 0 ? 'More than last cycle' : 'Less than last cycle')
                      : <>Ended at {formatSensitive(summary.growthEnding)}</>}
                  />
                )}
              </div>
            </Section>
          )}

          {/* Spending insights — backend-generated */}
          {(summary.largestTxn || summary.biggestDay || summary.avgDailySpend !== null || summary.velocityFirstHalf !== null || summary.noSpendDays > 0 || summary.transactionCount > 0) && (
            <Section title="Spending insights" icon={<Zap className="size-3 text-amber-400" />}>
              <div className="grid gap-3 sm:grid-cols-2">
                {summary.largestTxn && (
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Largest single expense</p>
                    <p className="mt-1 truncate text-xs font-bold text-foreground" title={summary.largestTxn.description}>{summary.largestTxn.description}</p>
                    <p className="mt-0.5 text-xs font-bold text-orange-400">{formatSensitive(Math.abs(summary.largestTxn.amount))}</p>
                  </div>
                )}
                {summary.biggestDay && (
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Highest spending day</p>
                    <p className="mt-1 text-xs font-bold text-foreground">
                      {new Date(summary.biggestDay.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-orange-400">{formatSensitive(summary.biggestDay.total)}</p>
                  </div>
                )}
                {summary.avgDailySpend !== null && (
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Average daily spend</p>
                    <p className="mt-1 text-xs font-bold text-foreground">{formatSensitive(summary.avgDailySpend)} / day</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Across a {summary.cycleLengthDays}-day cycle</p>
                  </div>
                )}
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">No-spend days</p>
                  <p className="mt-1 text-xs font-bold text-emerald-500">{summary.noSpendDays} days</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Days with zero expenses</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transaction count</p>
                  <p className="mt-1 text-xs font-bold text-foreground">{summary.transactionCount} expense entries</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Total purchases this cycle</p>
                </div>
                {summary.committedSpend + summary.discretionarySpend > 0 && (
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spend Type</p>
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Committed</span>
                        <span className="font-bold text-foreground">{formatSensitive(summary.committedSpend)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Discretionary</span>
                        <span className="font-bold text-foreground">{formatSensitive(summary.discretionarySpend)}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="bg-blue-500" style={{ width: `${(summary.committedSpend / (summary.committedSpend + summary.discretionarySpend)) * 100}%` }} />
                      <div className="bg-purple-500" style={{ width: `${(summary.discretionarySpend / (summary.committedSpend + summary.discretionarySpend)) * 100}%` }} />
                    </div>
                  </div>
                )}
                {summary.velocityFirstHalf !== null && summary.velocitySecondHalf !== null && (
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spending velocity</p>
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">First half</span>
                        <span className={`font-bold ${summary.velocityFirstHalf > summary.velocitySecondHalf ? 'text-orange-400' : 'text-foreground'}`}>{formatSensitive(summary.velocityFirstHalf)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Second half</span>
                        <span className={`font-bold ${summary.velocitySecondHalf > summary.velocityFirstHalf ? 'text-orange-400' : 'text-foreground'}`}>{formatSensitive(summary.velocitySecondHalf)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Lower sections: Where it went, Stability fund, Bills, claimed rewards */}
          {summary.topCategories.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <Section title="Where it went">
                  <div className="space-y-2.5 rounded-xl border border-border/50 bg-muted/20 p-3.5">
                    {summary.topCategories.map(category => (
                      <div key={category.category} className="flex items-center gap-2">
                        {/* Badge Container: fixed width so all bars start at the same X position without stretching the badge */}
                        <div className="w-24 shrink-0 flex items-center">
                          <span
                            className={`max-w-full truncate rounded border px-1.5 py-0.5 text-xs font-bold leading-tight ${getCategoryBadgeClass(category.category)}`}
                            title={category.category}
                          >
                            {category.category}
                          </span>
                        </div>
                        {/* Bar: grows to fill remaining space */}
                        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground/40 transition-all"
                            style={{ width: `${summary.topMax > 0 ? (category.amount / summary.topMax) * 100 : 0}%` }}
                          />
                        </div>
                        {/* Amount: fixed right-aligned column */}
                        <span className="w-20 shrink-0 text-right text-xs font-bold text-foreground">
                          {formatSensitive(category.amount)}
                        </span>
                      </div>
                    ))}
                    {summary.otherCategoriesCount > 0 && (
                      <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
                        <span className="min-w-0 truncate">
                          {summary.otherCategoriesCount} smaller {summary.otherCategoriesCount === 1 ? 'category' : 'categories'}
                        </span>
                        <span className="w-20 shrink-0 text-right font-bold">{formatSensitive(summary.otherCategoriesTotal)}</span>
                      </div>
                    )}
                  </div>
                </Section>
              </div>

              <div className="space-y-6">
                {summary.stabilityTarget > 0 && (
                  <StabilityFundSection summary={summary} formatSensitive={formatSensitive} />
                )}

                <CycleActivitySections summary={summary} formatSensitive={formatSensitive} />
              </div>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {summary.stabilityTarget > 0 && (
                <StabilityFundSection summary={summary} formatSensitive={formatSensitive} />
              )}

              <CycleActivitySections summary={summary} formatSensitive={formatSensitive} />
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  )
}

/**
 * `neutral` exists because these cards compare two cycles, and "no change" is a real third
 * answer. Forced into good/warn it had to be painted as one of them, and `trendUp` — a boolean —
 * had to pick an arrow, so an unchanged figure drew a downward trend in a colour that claimed a
 * verdict nobody had reached.
 */

/**
 * Tone for a card that reports a change between two cycles, from the change alone.
 *
 * `change` is in whatever unit the card rounds to before it words the detail line, so a movement
 * the copy calls "same as last cycle" cannot be painted as a movement. `higherIsBetter` flips it
 * for the cards where going up is the good news (savings rate, growth) versus the ones where going
 * down is (spending). `null` means there is nothing to compare against, not a change of zero.
 */
