import React from 'react'
import { activateOnKeyboard } from './activateOnKeyboard'
import type { NavigateToLedgerOptions } from './types'
import { cn } from '../../lib/utils'
import { panelClass } from '../ui/panelStyles'

interface GrowthMetric {
  target: number
  currentPct: number
  pending: number
  projectedRemaining: number
  atRiskPct: number
  safePct: number
}

interface EssentialsMetric {
  totalAvailable: number
  currentPct: number
  pending: number
  projectedRemaining: number
  projectedPct: number
  atRiskPct: number
}

interface StabilityMetric {
  hasTarget: boolean
  currentPct: number
  pending: number
  currentBalance: number
  projectedBalance: number
  projectedPct: number
  atRiskPct: number
}

interface FinancialPlanMetricsProps {
  growthMetric: GrowthMetric
  essentialsMetric: EssentialsMetric
  stabilityMetric: StabilityMetric
  growthAlloc: number
  targetStabilityFund: number
  formatSensitive: (val: number) => React.ReactNode
  onNavigateToLedger?: (options: NavigateToLedgerOptions) => void
}

export const FinancialPlanMetrics: React.FC<FinancialPlanMetricsProps> = ({
  growthMetric,
  essentialsMetric,
  stabilityMetric,
  growthAlloc,
  targetStabilityFund,
  formatSensitive,
  onNavigateToLedger,
}) => {
  const renderProjected = (pending: number, value: number) => {
    if (pending <= 0) return null
    return (
      <span className="mt-1 block font-medium text-amber-700 dark:text-amber-300">
        Projected after pending: {formatSensitive(value)}
      </span>
    )
  }

  return (
    <div className={cn(panelClass, 'p-6')}>
      <h3 className="text-section text-foreground mb-1">Financial Plan Metrics</h3>
      {/* Legend -- protan-safe: blue (current) + orange (pending) */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-blue-500 ring-1 ring-background" />
          <span className="text-xs font-medium text-muted-foreground">Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-orange-500 ring-1 ring-background" />
          <span className="text-xs font-medium text-muted-foreground">Pending deduction</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Growth Achieved */}
        <div
          onClick={() => onNavigateToLedger?.({ category: 'Growth', showAllCycles: true })}
          onKeyDown={(event) => activateOnKeyboard(event, () => onNavigateToLedger?.({ category: 'Growth', showAllCycles: true }))}
          role="button"
          tabIndex={0}
          className="interactive-card cursor-pointer space-y-2.5 rounded-control border border-transparent bg-surface-2/60 p-4 hover:bg-surface-2"
        >
          <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs font-semibold">
            <span className="text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
              <span className="size-2 rounded-full bg-violet-500 inline-block ring-1 ring-background" />
              Growth Achieved
            </span>
            <span className="text-foreground font-semibold tabular-nums">
              {(growthMetric.currentPct * 100).toFixed(1)}%
              {growthMetric.pending > 0 && (
                <span className="ml-1 text-amber-700 dark:text-amber-300">{'→'} {(growthMetric.safePct * 100).toFixed(1)}%</span>
              )}
            </span>
          </div>
          <div className="w-full bg-muted/80 rounded-full h-2.5 overflow-hidden flex">
            <div
              className="bg-violet-500 h-full transition-all duration-700 ease-out"
              style={{ width: `${growthMetric.safePct * 100}%` }}
            />
            {growthMetric.pending > 0 && growthMetric.atRiskPct > 0 && (
              <div
                className="bg-orange-500 h-full transition-all duration-700 ease-out"
                style={{ width: `${growthMetric.atRiskPct * 100}%` }}
              />
            )}
          </div>
          <span className="text-xs text-muted-foreground block leading-relaxed font-normal">
            Plan Target: Deposit <strong className="text-foreground">{(growthAlloc * 100).toFixed(0)}%</strong> of income (<span className="font-semibold text-foreground tabular-nums">{formatSensitive(growthMetric.target)}</span>) into savings this cycle.
            {renderProjected(growthMetric.pending, growthMetric.projectedRemaining)}
          </span>
        </div>

        {/* Essentials Remaining */}
        <div
          onClick={() => onNavigateToLedger?.({ category: 'Essentials', showAllCycles: false })}
          onKeyDown={(event) => activateOnKeyboard(event, () => onNavigateToLedger?.({ category: 'Essentials', showAllCycles: false }))}
          role="button"
          tabIndex={0}
          className="interactive-card cursor-pointer space-y-2.5 rounded-control border border-transparent bg-surface-2/60 p-4 hover:bg-surface-2"
        >
          <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs font-semibold">
            <span className="text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
              <span className="size-2 rounded-full bg-sky-500 inline-block ring-1 ring-background" />
              Essentials Remaining
            </span>
            <span className="text-foreground font-semibold tabular-nums">
              {(essentialsMetric.currentPct * 100).toFixed(1)}%
              {essentialsMetric.pending > 0 && (
                <span className="ml-1 text-amber-700 dark:text-amber-300">{'→'} {(essentialsMetric.projectedPct * 100).toFixed(1)}%</span>
              )}
            </span>
          </div>
          <div className="w-full bg-muted/80 rounded-full h-2.5 overflow-hidden flex">
            <div
              className="bg-sky-500 h-full transition-all duration-700 ease-out"
              style={{ width: `${essentialsMetric.projectedPct * 100}%` }}
            />
            {essentialsMetric.pending > 0 && essentialsMetric.atRiskPct > 0 && (
              <div
                className="bg-orange-500 h-full transition-all duration-700 ease-out"
                style={{ width: `${essentialsMetric.atRiskPct * 100}%` }}
              />
            )}
          </div>
          <span className="text-xs text-muted-foreground block leading-relaxed font-normal">
            Available budget: <strong className="text-foreground tabular-nums">{formatSensitive(essentialsMetric.totalAvailable)}</strong>.
            {renderProjected(essentialsMetric.pending, essentialsMetric.projectedRemaining)}
          </span>
        </div>

        {/* Stability Reached */}
        <div
          onClick={() => onNavigateToLedger?.({ category: 'Stability', showAllCycles: true })}
          onKeyDown={(event) => activateOnKeyboard(event, () => onNavigateToLedger?.({ category: 'Stability', showAllCycles: true }))}
          role="button"
          tabIndex={0}
          className="interactive-card cursor-pointer space-y-2.5 rounded-control border border-transparent bg-surface-2/60 p-4 hover:bg-surface-2"
        >
          <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs font-semibold">
            <span className="text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
              <span className="size-2 rounded-full bg-emerald-500 inline-block ring-1 ring-background" />
              {stabilityMetric.hasTarget ? 'Stability Cap Reached' : 'Stability Fund'}
            </span>
            <span className="text-foreground font-semibold tabular-nums">
              {stabilityMetric.hasTarget ? `${(stabilityMetric.currentPct * 100).toFixed(1)}%` : 'No limit set'}
              {stabilityMetric.pending > 0 && (
                <span className="ml-1 text-amber-700 dark:text-amber-300">{'→'} {(stabilityMetric.projectedPct * 100).toFixed(1)}%</span>
              )}
            </span>
          </div>
          {stabilityMetric.hasTarget && <div className="w-full bg-muted/80 rounded-full h-2.5 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-700 ease-out"
              style={{ width: `${stabilityMetric.projectedPct * 100}%` }}
            />
            {stabilityMetric.pending > 0 && stabilityMetric.atRiskPct > 0 && (
              <div
                className="bg-orange-500 h-full transition-all duration-700 ease-out"
                style={{ width: `${stabilityMetric.atRiskPct * 100}%` }}
              />
            )}
          </div>}
          <span className="text-xs text-muted-foreground block leading-relaxed font-normal">
            {stabilityMetric.hasTarget
              ? <>Target Stability Fund goal is <strong className="text-foreground tabular-nums">{formatSensitive(targetStabilityFund)}</strong>. </>
              : <>No Stability limit is set. </>}
            Currently at <span className="font-semibold text-foreground tabular-nums">{formatSensitive(stabilityMetric.currentBalance)}</span>.
            {renderProjected(stabilityMetric.pending, stabilityMetric.projectedBalance)}
          </span>
        </div>
      </div>
    </div>
  )
}
