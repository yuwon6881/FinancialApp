import React, { useMemo } from 'react'
import { CalendarClock, PiggyBank } from 'lucide-react'
import type { AppTab, WishlistItem } from '../../types'
import { AnimatedNumber } from '../ui/AnimatedNumber'
import { SensitiveAmount } from '../ui/SensitiveAmount'
import { getCycleProgress, MONTH_NAMES } from '../../lib/cycle'
import { activateOnKeyboard } from './activateOnKeyboard'

export interface WishlistGoal {
  item: WishlistItem
  rewardsBalance: number
  pct: number
  canAfford: boolean
}

interface TodayFocusCardsProps {
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  wishlistGoal: WishlistGoal | null
  hideSensitive: boolean
  formatCurrency: (val: number) => string
  formatSensitive: (val: number) => React.ReactNode
  onNavigate: (tab: AppTab) => void
}

const useCycleProgress = (selectedMonth: string, selectedYear: number, cycleDay: number) => {
  return useMemo(() => {
    const monthIndex = MONTH_NAMES.indexOf(selectedMonth) + 1
    const safeMonthIndex = monthIndex > 0 ? monthIndex : new Date().getMonth() + 1
    return getCycleProgress(selectedYear || new Date().getFullYear(), safeMonthIndex, cycleDay || 28)
  }, [selectedMonth, selectedYear, cycleDay])
}

export const TodayFocusCards: React.FC<TodayFocusCardsProps> = ({
  selectedMonth,
  selectedYear,
  cycleDay,
  wishlistGoal,
  hideSensitive,
  formatCurrency,
  formatSensitive,
  onNavigate,
}) => {
  const cycle = useCycleProgress(selectedMonth, selectedYear, cycleDay)
  const nextStartLabel = cycle.nextStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel = cycle.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const progressHeadline = cycle.phase === 'upcoming'
    ? `Starts in ${cycle.daysUntilStart} day${cycle.daysUntilStart === 1 ? '' : 's'}`
    : cycle.phase === 'ended'
      ? 'Cycle ended'
      : `Day ${cycle.dayNumber} of ${cycle.totalDays}`

  const progressCaption = cycle.phase === 'active'
    ? `${cycle.daysLeft} day${cycle.daysLeft === 1 ? '' : 's'} left · next cycle starts ${nextStartLabel}`
    : cycle.phase === 'upcoming'
      ? `${cycle.totalDays}-day cycle · next cycle starts ${nextStartLabel}`
      : `Ended ${endLabel}`

  return (
    <div className={`grid grid-cols-1 ${wishlistGoal ? 'md:grid-cols-2' : ''} gap-4`}>
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
            <span><SensitiveAmount value={wishlistGoal.rewardsBalance} isMasked={hideSensitive} formatFn={formatCurrency} /> saved</span>
            <span className="font-semibold text-foreground">{formatSensitive(wishlistGoal.item.price)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
