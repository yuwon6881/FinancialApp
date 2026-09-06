import React from 'react'
import { ChevronRight, Landmark } from 'lucide-react'
import type { AppTab } from '../../types'
import { cn } from '../../lib/utils'
import { panelClass } from '../ui/panelStyles'
import { SensitiveAmount } from '../ui/SensitiveAmount'
import { InteractiveCard } from '../ui/InteractiveCard'

export interface NetWorthCardProps {
  /** Sum of all 4 bucket balances (Essentials + Growth + Stability + Rewards) */
  totalAccountBalance: number
  /** Investment portfolio total value (market + cash). undefined = not loaded/configured */
  investmentValue?: number
  /** Total outstanding loan debt. null = not yet loaded; 0 = no loans */
  loanDebt: number | null
  /** Whether values should be privacy-masked */
  isMasked: boolean
  /** Currency formatter */
  formatCurrency: (val: number) => string
  /** Navigate to another tab */
  onNavigate: (tab: AppTab) => void
  /** Optional callback to open ledger */
  onNavigateToLedger?: () => void
}

export const NetWorthCard: React.FC<NetWorthCardProps> = ({
  totalAccountBalance,
  investmentValue,
  loanDebt,
  isMasked,
  formatCurrency,
  onNavigate,
  onNavigateToLedger,
}) => {
  const hasInvestments = investmentValue !== undefined
  const hasLoans = loanDebt !== null
  const effectiveDebt = hasLoans ? Math.max(0, loanDebt) : 0
  const effectiveInvestments = hasInvestments ? investmentValue : 0
  const netWorth = totalAccountBalance + effectiveInvestments - effectiveDebt

  const isPartial = !hasInvestments || !hasLoans

  return (
    <section aria-labelledby="net-worth-heading" className={cn(panelClass, 'p-4 sm:p-5')}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
            <Landmark className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 id="net-worth-heading" className="text-section text-foreground">
                Net Worth
              </h3>
              {isPartial && (
                <span className="rounded bg-muted/70 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  Partial
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {!hasInvestments && !hasLoans
                ? 'Investments and loans not loaded'
                : !hasInvestments
                  ? 'Excludes investments (not configured or loaded)'
                  : !hasLoans
                    ? 'Loan liabilities syncing'
                    : 'Total assets minus liabilities'}
            </p>
          </div>
        </div>

        <div className="flex items-baseline gap-2 sm:text-right">
          <span className="text-xs font-semibold text-muted-foreground sm:hidden">Total:</span>
          <span
            className={cn(
              'text-2xl sm:text-3xl font-black tracking-tight tabular-nums',
              netWorth < 0 ? 'text-orange-500 dark:text-orange-400' : 'text-foreground',
            )}
          >
            <SensitiveAmount value={netWorth} isMasked={isMasked} formatFn={formatCurrency} />
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <InteractiveCard
          surface="plain"
          onClick={() => (onNavigateToLedger ? onNavigateToLedger() : onNavigate('ledger'))}
          className="rounded-xl border border-border/50 bg-muted/25 p-3 sm:p-3.5 hover:bg-muted/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Cash & Savings</span>
            <ChevronRight className="size-3 text-muted-foreground/60" />
          </div>
          <span className="mt-1 block text-lg font-bold text-foreground tabular-nums">
            <SensitiveAmount value={totalAccountBalance} isMasked={isMasked} formatFn={formatCurrency} />
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">All 4 bucket accounts</span>
        </InteractiveCard>

        <InteractiveCard
          surface="plain"
          onClick={() => onNavigate('investments')}
          className="rounded-xl border border-border/50 bg-muted/25 p-3 sm:p-3.5 hover:bg-muted/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Investments</span>
            <ChevronRight className="size-3 text-muted-foreground/60" />
          </div>
          <span className="mt-1 block text-lg font-bold text-foreground tabular-nums">
            {hasInvestments ? (
              <SensitiveAmount value={investmentValue} isMasked={isMasked} formatFn={formatCurrency} />
            ) : (
              <span className="text-sm font-medium text-muted-foreground">Not available yet</span>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">Portfolio total value</span>
        </InteractiveCard>

        <InteractiveCard
          surface="plain"
          onClick={() => onNavigate('recurring')}
          className="rounded-xl border border-border/50 bg-muted/25 p-3 sm:p-3.5 hover:bg-muted/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Liabilities</span>
            <ChevronRight className="size-3 text-muted-foreground/60" />
          </div>
          <span
            className={cn(
              'mt-1 block text-lg font-bold tabular-nums',
              hasLoans && loanDebt > 0 ? 'text-orange-500 dark:text-orange-400' : 'text-foreground',
            )}
          >
            {hasLoans ? (
              <SensitiveAmount
                value={loanDebt}
                isMasked={isMasked}
                formatFn={val => (val > 0 ? `-${formatCurrency(val)}` : formatCurrency(val))}
              />
            ) : (
              <span className="text-sm font-medium text-muted-foreground">Syncing...</span>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">Outstanding loan debt</span>
        </InteractiveCard>
      </div>
    </section>
  )
}
