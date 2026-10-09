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
          <h3 id="ledger-balance-reconciliation-title" className="text-subsection text-foreground">{category.name} balance for {cycleLabel}</h3>
        </div>
        <InfoHint label={`${category.name} balance calculation`} text="Debit and credit below cover the visible page and leave out internal transfers. This balance uses the complete cycle and includes your bucket’s share of allocations and transfers." />
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center sm:gap-3">
        <div className="rounded-control bg-surface-2/70 px-3.5 py-3">
          <dt className="text-label text-muted-foreground">At cycle start</dt>
          <dd className="mt-1 text-section tabular-nums text-foreground">{formatSensitive(category.budget)}</dd>
        </div>
        <span className="hidden text-center text-section text-muted-foreground sm:block" aria-hidden="true">+</span>
        <div className="rounded-control bg-surface-2/70 px-3.5 py-3">
          <dt className="text-label text-muted-foreground">Movement this cycle</dt>
          <dd className={`mt-1 text-section tabular-nums ${category.netChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>{movementPrefix}{formatSensitive(Math.abs(category.netChange))}</dd>
        </div>
        <span className="hidden text-center text-section text-muted-foreground sm:block" aria-hidden="true">=</span>
        <div className="rounded-control bg-primary/8 px-3.5 py-3">
          <dt className="text-label text-muted-foreground">Left after movement</dt>
          <dd className="mt-1 text-section font-semibold tabular-nums text-foreground">{formatSensitive(category.remaining)}</dd>
        </div>
      </dl>
    </Panel>
  )
}
