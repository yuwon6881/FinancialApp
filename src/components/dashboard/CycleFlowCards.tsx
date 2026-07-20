import React from 'react'
import { ArrowDownLeft, ArrowUpRight, PiggyBank } from 'lucide-react'
import type { WishlistItem } from '../../types'
import { AnimatedNumber } from '../ui/AnimatedNumber'
import { SENSITIVE_AMOUNT_MASK } from '../../lib/utils'
import { activateOnKeyboard } from './activateOnKeyboard'
import type { NavigateToLedgerOptions } from './types'

interface CycleFlowStats {
  monthlyIncome: number
  monthlyInflow: number
  monthlyExpenses: number
  activeRecurringTotal: number
}

export interface WishlistGoal {
  item: WishlistItem
  rewardsBalance: number
  pct: number
  canAfford: boolean
}

interface CycleFlowCardsProps {
  stats: CycleFlowStats
  wishlistGoal: WishlistGoal | null
  hideSensitive: boolean
  formatCurrency: (val: number) => string
  formatSensitive: (val: number) => React.ReactNode
  onNavigate: (tab: 'dashboard' | 'recurring' | 'ledger' | 'wishlist' | 'settings') => void
  onNavigateToLedger?: (options: NavigateToLedgerOptions) => void
}

export const CycleFlowCards: React.FC<CycleFlowCardsProps> = ({
  stats,
  wishlistGoal,
  hideSensitive,
  formatCurrency,
  formatSensitive,
  onNavigate,
  onNavigateToLedger,
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${wishlistGoal ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4`}>
      {/* Inflow Card */}
      <div
        onClick={() => onNavigateToLedger?.({ txType: 'inflow' })}
        onKeyDown={(event) => activateOnKeyboard(event, () => onNavigateToLedger?.({ txType: 'inflow' }))}
        role="button"
        tabIndex={0}
        className="metric-card interactive-card app-panel p-6 rounded-2xl bg-card border border-border/70 hover:border-teal-500/40 transition-all duration-300 group cursor-pointer shadow-xs hover:shadow-md"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground">Cycle Inflow</span>
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 group-hover:scale-110 transition-transform duration-300">
            <ArrowDownLeft className="size-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-foreground">
          {hideSensitive ? SENSITIVE_AMOUNT_MASK : <AnimatedNumber value={stats.monthlyInflow} formatFn={formatCurrency} />}
        </div>
        <p className="text-[10px] mt-1.5 text-muted-foreground">
          Total Actual Income: <span className="font-semibold text-teal-600 dark:text-teal-400">{formatSensitive(stats.monthlyIncome)}</span>
        </p>
      </div>

      {/* Expenses Card */}
      <div
        onClick={() => onNavigateToLedger?.({ txType: 'outflow' })}
        onKeyDown={(event) => activateOnKeyboard(event, () => onNavigateToLedger?.({ txType: 'outflow' }))}
        role="button"
        tabIndex={0}
        className="metric-card interactive-card app-panel p-6 rounded-2xl bg-card border border-border/70 hover:border-rose-500/40 transition-all duration-300 group cursor-pointer shadow-xs hover:shadow-md"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground">Cycle Outflow</span>
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 group-hover:scale-110 transition-transform duration-300">
            <ArrowUpRight className="size-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-foreground">
          {hideSensitive ? SENSITIVE_AMOUNT_MASK : <AnimatedNumber value={stats.monthlyExpenses} formatFn={formatCurrency} />}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Active committed bills: <span className="font-semibold text-rose-600 dark:text-rose-400">{formatSensitive(stats.activeRecurringTotal)}</span>/mo
        </p>
      </div>

      {/* Wishlist Goal Card (Shown when active goal exists) */}
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
