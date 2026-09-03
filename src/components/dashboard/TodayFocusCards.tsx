import React, { useMemo } from 'react'
import { CalendarClock } from 'lucide-react'
import { RewardIcon } from '../semanticIcons'
import type { AppTab, WishlistItem } from '../../types'
import { AnimatedNumber } from '../ui/AnimatedNumber'
import { SensitiveAmount } from '../ui/SensitiveAmount'
import { getCycleProgress, MONTH_NAMES } from '../../lib/cycle'
import { activateOnKeyboard } from './activateOnKeyboard'
import { cn } from '../../lib/utils'
import { panelClass } from '../ui/Panel'

interface WishlistGoal {
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
      <div className={cn('metric-card', panelClass, 'p-6')}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground">Cycle progress</span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20">
            <CalendarClock className="size-4.5" />
          </div>
        </div>
        <div className="text-2xl font-black tracking-tight text-foreground">{progressHeadline}</div>
        <div className="w-full bg-muted rounded-full h-2 mt-3 overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${cycle.progressPct}%` }}
          />
        </div>
        <p className="text-xs mt-2.5 text-muted-foreground font-medium">{progressCaption}</p>
      </div>

      {/* Focused reward (shown when an open reward exists) */}
      {wishlistGoal && (
        <div
          onClick={() => onNavigate('wishlist')}
          onKeyDown={(event) => activateOnKeyboard(event, () => onNavigate('wishlist'))}
          role="button"
          tabIndex={0}
          className={cn('metric-card interactive-card', panelClass, 'group cursor-pointer p-6 transition-all duration-300',
            wishlistGoal.canAfford
              ? 'border-blue-500/50 hover:border-blue-500/70 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/10'
              : 'border-border/60 hover:border-blue-500/30',
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground truncate max-w-[70%]">Reward: {wishlistGoal.item.name}</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20 group-hover:scale-105 transition-transform duration-300">
              <RewardIcon className="size-4.5" aria-hidden />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-foreground tabular-nums">
            <AnimatedNumber value={wishlistGoal.pct} formatFn={(val) => val.toFixed(0) + '%'} />
          </div>
          <div className="w-full bg-muted rounded-full h-2.5 mt-2.5 overflow-hidden flex">
            <div
              className="h-full bg-blue-500 transition-all duration-500 rounded-full"
              style={{ width: `${wishlistGoal.pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2.5 flex justify-between font-medium">
            <span><SensitiveAmount value={wishlistGoal.rewardsBalance} isMasked={hideSensitive} formatFn={formatCurrency} /> saved</span>
            <span className="font-bold text-foreground">{formatSensitive(wishlistGoal.item.price)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
