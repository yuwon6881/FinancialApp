import React, { useMemo } from 'react'
import { CalendarClock, Coins, PiggyBank } from 'lucide-react'
import type { AppTab, WishlistItem } from '../../types'
import { AnimatedNumber } from '../ui/AnimatedNumber'
import { SENSITIVE_AMOUNT_MASK } from '../../lib/utils'
import { getCycleRangeDates, MONTH_NAMES } from '../../lib/cycle'
import { activateOnKeyboard } from './activateOnKeyboard'
import type { NavigateToLedgerOptions } from './types'

export interface WishlistGoal {
  item: WishlistItem
  rewardsBalance: number
  pct: number
  canAfford: boolean
}

interface TodayFocusCardsProps {
  essentialsRemaining: number
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  wishlistGoal: WishlistGoal | null
  hideSensitive: boolean
  formatCurrency: (val: number) => string
  formatSensitive: (val: number) => React.ReactNode
  onNavigate: (tab: AppTab) => void
  onNavigateToLedger?: (options: NavigateToLedgerOptions) => void
}

const DAY_MS = 24 * 60 * 60 * 1000
const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

type CyclePhase = 'upcoming' | 'active' | 'ended'

interface CycleProgress {
  phase: CyclePhase
  totalDays: number
  dayNumber: number
  daysLeft: number
  daysUntilStart: number
  progressPct: number
  endDate: Date
}

const useCycleProgress = (selectedMonth: string, selectedYear: number, cycleDay: number): CycleProgress => {
  return useMemo(() => {
    const monthIndex = MONTH_NAMES.indexOf(selectedMonth) + 1
    const safeMonthIndex = monthIndex > 0 ? monthIndex : new Date().getMonth() + 1
    const { start, end } = getCycleRangeDates(selectedYear || new Date().getFullYear(), safeMonthIndex, cycleDay || 28)
    const startMid = midnight(start)
    const endMid = midnight(end)
    const todayMid = midnight(new Date())
    const totalDays = Math.max(1, Math.round((endMid - startMid) / DAY_MS) + 1)

    if (todayMid < startMid) {
      return {
        phase: 'upcoming', totalDays, dayNumber: 0, daysLeft: totalDays,
        daysUntilStart: Math.round((startMid - todayMid) / DAY_MS), progressPct: 0, endDate: end,
      }
    }
    if (todayMid > endMid) {
      return { phase: 'ended', totalDays, dayNumber: totalDays, daysLeft: 0, daysUntilStart: 0, progressPct: 100, endDate: end }
    }
    const dayNumber = Math.round((todayMid - startMid) / DAY_MS) + 1
    const daysLeft = Math.round((endMid - todayMid) / DAY_MS) + 1
    return {
      phase: 'active', totalDays, dayNumber, daysLeft, daysUntilStart: 0,
      progressPct: Math.min(100, Math.round((dayNumber / totalDays) * 100)), endDate: end,
    }
  }, [selectedMonth, selectedYear, cycleDay])
}

export const TodayFocusCards: React.FC<TodayFocusCardsProps> = ({
  essentialsRemaining,
  selectedMonth,
  selectedYear,
  cycleDay,
  wishlistGoal,
  hideSensitive,
  formatCurrency,
  formatSensitive,
  onNavigate,
  onNavigateToLedger,
}) => {
  const cycle = useCycleProgress(selectedMonth, selectedYear, cycleDay)
  const resetLabel = cycle.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Days across which the remaining Essentials budget can still be spent.
  const spendDays = cycle.phase === 'active' ? cycle.daysLeft : cycle.phase === 'upcoming' ? cycle.totalDays : 1
  const perDay = essentialsRemaining / Math.max(1, spendDays)

  const progressHeadline = cycle.phase === 'upcoming'
    ? `Starts in ${cycle.daysUntilStart} day${cycle.daysUntilStart === 1 ? '' : 's'}`
    : cycle.phase === 'ended'
      ? 'Cycle ended'
      : `Day ${cycle.dayNumber} of ${cycle.totalDays}`

  const progressCaption = cycle.phase === 'active'
    ? `${cycle.daysLeft} day${cycle.daysLeft === 1 ? '' : 's'} left · resets ${resetLabel}`
    : cycle.phase === 'upcoming'
      ? `${cycle.totalDays}-day cycle · resets ${resetLabel}`
      : `Ended ${resetLabel}`

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${wishlistGoal ? 'lg:grid-cols-3' : ''} gap-4`}>
      {/* Cycle progress */}
      <div className="metric-card app-panel p-6 rounded-2xl bg-card/92 border border-border/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground">Cycle progress</span>
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
            <CalendarClock className="size-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-foreground">{progressHeadline}</div>
        <div className="w-full bg-muted rounded-full h-2 mt-3 overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${cycle.progressPct}%` }}
          />
        </div>
        <p className="text-[10px] mt-2 text-muted-foreground">{progressCaption}</p>
      </div>

      {/* Safe to spend per day */}
      <div
        onClick={() => onNavigateToLedger?.({ category: 'Essentials' })}
        onKeyDown={(event) => activateOnKeyboard(event, () => onNavigateToLedger?.({ category: 'Essentials' }))}
        role="button"
        tabIndex={0}
        className="metric-card interactive-card app-panel p-6 rounded-2xl bg-card/92 border border-border/60 hover:border-emerald-500/30 transition-all duration-300 group cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground">Safe to spend / day</span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform duration-300">
            <Coins className="size-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-foreground">
          {hideSensitive
            ? SENSITIVE_AMOUNT_MASK
            : cycle.phase === 'ended'
              ? formatSensitive(essentialsRemaining)
              : <><AnimatedNumber value={Math.max(0, perDay)} formatFn={formatCurrency} /><span className="text-sm font-bold text-muted-foreground">/day</span></>}
        </div>
        <p className="text-[10px] mt-1.5 text-muted-foreground">
          {cycle.phase === 'ended'
            ? <>Essentials left this cycle</>
            : <>Essentials <span className="font-semibold text-emerald-500">{formatSensitive(Math.max(0, essentialsRemaining))}</span> over {spendDays} day{spendDays === 1 ? '' : 's'}</>}
        </p>
      </div>

      {/* Wishlist goal (shown when an active goal exists) */}
      {wishlistGoal && (
        <div
          onClick={() => onNavigate('wishlist')}
          onKeyDown={(event) => activateOnKeyboard(event, () => onNavigate('wishlist'))}
          role="button"
          tabIndex={0}
          className={`metric-card interactive-card app-panel p-6 rounded-2xl bg-card/92 border transition-all duration-300 group cursor-pointer ${
            wishlistGoal.canAfford
              ? 'border-blue-500/50 hover:border-blue-500/70 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/10'
              : 'border-border/60 hover:border-blue-500/30'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground truncate max-w-[70%]">Goal: {wishlistGoal.item.name}</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform duration-300">
              <PiggyBank className="size-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            <AnimatedNumber value={wishlistGoal.pct} formatFn={(val) => val.toFixed(0) + '%'} />
          </div>
          <div className="w-full bg-muted rounded-full h-2.5 mt-2 overflow-hidden flex">
            <div
              className="h-full bg-blue-500 transition-all duration-500 rounded-full"
              style={{ width: `${wishlistGoal.pct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 flex justify-between">
            <span>{hideSensitive ? SENSITIVE_AMOUNT_MASK : <AnimatedNumber value={wishlistGoal.rewardsBalance} formatFn={formatCurrency} />} saved</span>
            <span className="font-semibold text-foreground">{formatSensitive(wishlistGoal.item.price)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
