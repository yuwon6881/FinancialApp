import React from 'react'
import { activateOnKeyboard } from './activateOnKeyboard'
import type { NavigateToLedgerOptions } from './types'

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
      <span className="block mt-1 text-orange-500 font-semibold">
        Projected after pending: {formatSensitive(value)}
      </span>
    )
  }

  return (
    <div className="app-panel p-6 bg-card/92 border border-border/60 rounded-2xl">
      <h3 className="text-base font-bold text-foreground mb-1">Financial Plan Metrics</h3>
      <p className="text-xs text-muted-foreground mb-1">Cycle-wide constraint evaluation across allocation categories and targets.</p>
      {/* Legend -- protan-safe: blue (current) + orange (pending) */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-2 rounded-sm bg-blue-500" />
          <span className="text-[10px] text-muted-foreground">Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-2 rounded-sm bg-orange-500" />
          <span className="text-[10px] text-muted-foreground">Pending deduction</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Growth Achieved */}
        <div
          onClick={() => onNavigateToLedger?.({ category: 'Growth', showAllCycles: true })}
          onKeyDown={(event) => activateOnKeyboard(event, () => onNavigateToLedger?.({ category: 'Growth', showAllCycles: true }))}
          role="button"
          tabIndex={0}
          className="interactive-card space-y-2 p-4 rounded-xl bg-muted/30 hover:bg-muted/60 border border-border/40 hover:border-violet-500/40 shadow-xs hover:shadow-lg hover:shadow-violet-500/5 hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
        >
          <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs font-semibold">
            <span className="text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
              Growth Achieved
            </span>
            <span className="text-foreground">
              {(growthMetric.currentPct * 100).toFixed(1)}%
              {growthMetric.pending > 0 && (
                <span className="text-orange-500 ml-1">{'→'} {(growthMetric.safePct * 100).toFixed(1)}%</span>
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
          <span className="text-[10px] text-muted-foreground block leading-relaxed">
            Plan Target: Deposit <strong>{(growthAlloc * 100).toFixed(0)}%</strong> of income ({formatSensitive(growthMetric.target)}) into savings this cycle.
            {renderProjected(growthMetric.pending, growthMetric.projectedRemaining)}
          </span>
        </div>

        {/* Essentials Remaining */}
        <div
          onClick={() => onNavigateToLedger?.({ category: 'Essentials', showAllCycles: false })}
          onKeyDown={(event) => activateOnKeyboard(event, () => onNavigateToLedger?.({ category: 'Essentials', showAllCycles: false }))}
          role="button"
          tabIndex={0}
          className="interactive-card space-y-2 p-4 rounded-xl bg-muted/30 hover:bg-muted/60 border border-border/40 hover:border-sky-500/40 shadow-xs hover:shadow-lg hover:shadow-sky-500/5 hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
        >
          <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs font-semibold">
            <span className="text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
              Essentials Remaining
            </span>
            <span className="text-foreground">
              {(essentialsMetric.currentPct * 100).toFixed(1)}%
              {essentialsMetric.pending > 0 && (
                <span className="text-orange-500 ml-1">{'→'} {(essentialsMetric.projectedPct * 100).toFixed(1)}%</span>
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
          <span className="text-[10px] text-muted-foreground block leading-relaxed">
            Available budget: <strong>{formatSensitive(essentialsMetric.totalAvailable)}</strong>.
            {renderProjected(essentialsMetric.pending, essentialsMetric.projectedRemaining)}
          </span>
        </div>

        {/* Stability Reached */}
        <div
          onClick={() => onNavigateToLedger?.({ category: 'Stability', showAllCycles: true })}
          onKeyDown={(event) => activateOnKeyboard(event, () => onNavigateToLedger?.({ category: 'Stability', showAllCycles: true }))}
          role="button"
          tabIndex={0}
          className="interactive-card space-y-2 p-4 rounded-xl bg-muted/30 hover:bg-muted/60 border border-border/40 hover:border-emerald-500/40 shadow-xs hover:shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
        >
          <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs font-semibold">
            <span className="text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              {stabilityMetric.hasTarget ? 'Stability Cap Reached' : 'Stability Fund'}
            </span>
            <span className="text-foreground">
              {stabilityMetric.hasTarget ? `${(stabilityMetric.currentPct * 100).toFixed(1)}%` : 'No limit set'}
              {stabilityMetric.pending > 0 && (
                <span className="text-orange-500 ml-1">{'→'} {(stabilityMetric.projectedPct * 100).toFixed(1)}%</span>
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
          <span className="text-[10px] text-muted-foreground block leading-relaxed">
            {stabilityMetric.hasTarget
              ? <>Target Stability Fund goal is <strong>{formatSensitive(targetStabilityFund)}</strong>. </>
              : <>No Stability limit is set. </>}
            Currently at {formatSensitive(stabilityMetric.currentBalance)}.
            {renderProjected(stabilityMetric.pending, stabilityMetric.projectedBalance)}
          </span>
        </div>
      </div>
    </div>
  )
}
