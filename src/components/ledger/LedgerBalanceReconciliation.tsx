import type { ReactNode } from 'react'
import type { CategorySummary } from '../../types'
import { InfoHint } from '../ui/InfoHint'
import { Panel } from '../ui/Panel'

interface LedgerBalanceReconciliationProps {
  category: CategorySummary
  cycleLabel: string
  formatSensitive: (value: number) => ReactNode
}

export function LedgerBalanceReconciliation({ category, cycleLabel, formatSensitive }: LedgerBalanceReconciliationProps) {
  const movementPrefix = category.netChange > 0 ? '+' : category.netChange < 0 ? '−' : ''
  return (
    <Panel as="section" aria-labelledby="ledger-balance-reconciliation-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="ledger-balance-reconciliation-title" className="text-sm font-bold text-foreground">{category.name} balance for {cycleLabel}</h3>
          <p className="mt-1 text-xs text-muted-foreground">How this cycle’s activity arrives at the amount left.</p>
        </div>
        <InfoHint label={`${category.name} balance calculation`} text="Debit and credit below cover the visible page and leave out internal transfers. This balance uses the complete cycle and includes your bucket’s share of allocations and transfers." />
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
        <div className="rounded-xl border border-border/50 bg-muted/25 p-3">
          <dt className="text-eyebrow uppercase text-muted-foreground">At cycle start</dt>
          <dd className="mt-1 text-base font-extrabold tabular-nums text-foreground">{formatSensitive(category.budget)}</dd>
        </div>
        <span className="hidden text-muted-foreground sm:block" aria-hidden="true">+</span>
        <div className="rounded-xl border border-border/50 bg-muted/25 p-3">
          <dt className="text-eyebrow uppercase text-muted-foreground">Movement this cycle</dt>
          <dd className={`mt-1 text-base font-extrabold tabular-nums ${category.netChange >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>{movementPrefix}{formatSensitive(Math.abs(category.netChange))}</dd>
        </div>
        <span className="hidden text-muted-foreground sm:block" aria-hidden="true">=</span>
        <div className="rounded-xl border border-blue-500/25 bg-blue-500/8 p-3">
          <dt className="text-eyebrow uppercase text-muted-foreground">Left after movement</dt>
          <dd className="mt-1 text-base font-black tabular-nums text-foreground">{formatSensitive(category.remaining)}</dd>
        </div>
      </dl>
    </Panel>
  )
}
