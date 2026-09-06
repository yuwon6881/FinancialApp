import React from 'react'
import { Landmark } from 'lucide-react'
import { cn } from '../../lib/utils'
import { panelClass } from '../ui/panelStyles'
import { Badge } from '../ui/Badge'
import { InfoHint } from '../ui/InfoHint'
import { SensitiveAmount } from '../ui/SensitiveAmount'

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
}

const COMPOSITION_EXPLANATION =
  'Cash is every ledger account across the four buckets. Investments is the broker portfolio — its holdings '
  + 'plus its own cash — which the app keeps as a separate ledger, so bucket money is never counted as portfolio '
  + 'value. Loans is what is still owed. Anything not loaded yet is left out and the figure is marked partial.'

/**
 * The one-line standing: what is owned minus what is owed.
 *
 * Deliberately a read-only strip rather than a panel of tiles. Today's page already navigates to
 * the ledger, the portfolio and the loans from the surfaces that own them, and each of the three
 * parts is one figure -- three cards' worth of chrome for three numbers pushed the cycle's own
 * cards below the fold.
 *
 * A part that has not loaded stays absent instead of counting as zero, and the total says so.
 */
export const NetWorthCard: React.FC<NetWorthCardProps> = ({
  totalAccountBalance,
  investmentValue,
  loanDebt,
  isMasked,
  formatCurrency,
}) => {
  const hasInvestments = investmentValue !== undefined
  const hasLoans = loanDebt !== null
  const effectiveDebt = hasLoans ? Math.max(0, loanDebt) : 0
  const netWorth = totalAccountBalance + (hasInvestments ? investmentValue : 0) - effectiveDebt
  const isPartial = !hasInvestments || !hasLoans

  const parts: Array<{ label: string; value: number | null; tone?: string }> = [
    { label: 'Cash', value: totalAccountBalance },
    { label: 'Investments', value: hasInvestments ? investmentValue : null },
    {
      label: 'Loans',
      value: hasLoans ? -effectiveDebt : null,
      tone: hasLoans && effectiveDebt > 0 ? 'text-orange-500 dark:text-orange-400' : undefined,
    },
  ]

  return (
    <section aria-labelledby="net-worth-heading" className={cn(panelClass, 'px-4 py-3 sm:px-5')}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Landmark className="size-4 shrink-0 text-blue-500" aria-hidden />
          <h3 id="net-worth-heading" className="text-subsection text-foreground">Net worth</h3>
          <InfoHint inline label="how net worth is put together" text={COMPOSITION_EXPLANATION} />
          {isPartial && <Badge tone="neutral">Partial</Badge>}
        </div>
        <span
          className={cn(
            'text-title font-black tabular-nums',
            netWorth < 0 ? 'text-orange-500 dark:text-orange-400' : 'text-foreground',
          )}
        >
          <SensitiveAmount value={netWorth} isMasked={isMasked} formatFn={formatCurrency} />
        </span>
      </div>

      <dl className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
        {parts.map(part => (
          <div key={part.label} className="flex items-baseline gap-1.5">
            <dt className="text-caption text-muted-foreground">{part.label}</dt>
            <dd className={cn('text-caption font-semibold tabular-nums', part.tone ?? 'text-foreground')}>
              {part.value === null
                ? <span className="text-muted-foreground">Not counted yet</span>
                : <SensitiveAmount value={part.value} isMasked={isMasked} formatFn={formatCurrency} />}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
