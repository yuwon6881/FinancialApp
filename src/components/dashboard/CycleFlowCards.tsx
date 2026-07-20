import React from 'react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
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
        className="metric-card interactive-card app-panel p-6 rounded-2xl bg-card/92 border border-border/60 hover:border-teal-500/30 transition-all duration-300 group cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground">Cycle Inflow</span>
          <div className="p-2 rounded-lg bg-teal-500/10 text-teal-500 group-hover:scale-110 transition-transform duration-300">
            <ArrowDownLeft className="size-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-foreground">
          {hideSensitive ? SENSITIVE_AMOUNT_MASK : <AnimatedNumber value={stats.monthlyInflow} formatFn={formatCurrency} />}
        </div>
        <p className="text-[10px] mt-1.5 text-muted-foreground">
          Total Actual Income: <span className="font-semibold text-teal-500">{formatSensitive(stats.monthlyIncome)}</span>
        </p>
      </div>

      {/* Expenses Card */}
      <div
        onClick={() => onNavigateToLedger?.({ txType: 'outflow' })}
        onKeyDown={(event) => activateOnKeyboard(event, () => onNavigateToLedger?.({ txType: 'outflow' }))}
        role="button"
        tabIndex={0}
        className="metric-card interactive-card app-panel p-6 rounded-2xl bg-card/92 border border-border/60 hover:border-orange-500/30 transition-all duration-300 group cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground">Cycle Outflow</span>
          <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-transform duration-300">
            <ArrowUpRight className="size-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-foreground">
          {hideSensitive ? SENSITIVE_AMOUNT_MASK : <AnimatedNumber value={stats.monthlyExpenses} formatFn={formatCurrency} />}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Active committed bills: <span className="font-semibold text-orange-500">{formatSensitive(stats.activeRecurringTotal)}</span>/mo
        </p>
      </div>
    </div>
  )
}
