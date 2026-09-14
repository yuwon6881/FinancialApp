import React from 'react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { SensitiveAmount } from '../ui/SensitiveAmount'
import { activateOnKeyboard } from './activateOnKeyboard'
import type { NavigateToLedgerOptions } from './types'
import { cn } from '../../lib/utils'
import { panelClass } from '../ui/panelStyles'

interface CycleFlowStats {
  monthlyIncome: number
  monthlyInflow: number
  monthlyExpenses: number
  activeRecurringTotal: number
}

interface CycleFlowCardsProps {
  stats: CycleFlowStats
  hideSensitive: boolean
  formatCurrency: (val: number) => string
  formatSensitive: (val: number) => React.ReactNode
  onNavigateToLedger?: (options: NavigateToLedgerOptions) => void
}

export const CycleFlowCards: React.FC<CycleFlowCardsProps> = ({
  stats,
  hideSensitive,
  formatCurrency,
  formatSensitive,
  onNavigateToLedger,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Inflow Card */}
      <div
        onClick={() => onNavigateToLedger?.({ txType: 'inflow' })}
        onKeyDown={(event) => activateOnKeyboard(event, () => onNavigateToLedger?.({ txType: 'inflow' }))}
        role="button"
        tabIndex={0}
        className={cn('metric-card interactive-card', panelClass, 'group cursor-pointer p-6 transition-all duration-300 hover:border-teal-500/30')}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground">Cycle Inflow</span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-500 ring-1 ring-teal-500/20 group-hover:scale-105 transition-transform duration-300">
            <ArrowDownLeft className="size-4.5" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground tabular-nums">
          <SensitiveAmount value={stats.monthlyInflow} isMasked={hideSensitive} formatFn={formatCurrency} />
        </div>
        <p className="text-xs mt-2 text-muted-foreground font-medium">
          <span className="hidden sm:inline">Total Actual </span>Income: <span className="font-bold text-teal-500 tabular-nums">{formatSensitive(stats.monthlyIncome)}</span>
        </p>
      </div>

      {/* Expenses Card */}
      <div
        onClick={() => onNavigateToLedger?.({ txType: 'outflow' })}
        onKeyDown={(event) => activateOnKeyboard(event, () => onNavigateToLedger?.({ txType: 'outflow' }))}
        role="button"
        tabIndex={0}
        className={cn('metric-card interactive-card', panelClass, 'group cursor-pointer p-6 transition-all duration-300 hover:border-orange-500/30')}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground">Cycle Outflow</span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20 group-hover:scale-105 transition-transform duration-300">
            <ArrowUpRight className="size-4.5" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground tabular-nums">
          <SensitiveAmount value={stats.monthlyExpenses} isMasked={hideSensitive} formatFn={formatCurrency} />
        </div>
        <p className="text-xs text-muted-foreground mt-2 font-medium">
          <span className="hidden sm:inline">Active </span>Bills<span className="hidden sm:inline"> (monthly equivalent)</span>: <span className="font-bold text-orange-500 tabular-nums">{formatSensitive(stats.activeRecurringTotal)}</span>/mo
        </p>
      </div>
    </div>
  )
}
