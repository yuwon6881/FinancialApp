import { useMemo, useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { ChevronDown, HandCoins } from 'lucide-react'
import type { InvestmentAllocationOverview } from '../../types'
import { Button } from '../ui/Button'
import { InfoHint } from '../ui/InfoHint'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { maskCurrencyInput } from '../../lib/utils'
import { planWithdrawal, type WithdrawalSleeveInput } from '../../lib/investmentWithdrawal'
import type { SleeveConstituent } from '../../lib/investmentSleeveBreakdown'
import { Badge } from '../ui/Badge'

interface WithdrawalGuideProps {
  allocation: InvestmentAllocationOverview
  /** Already grouped by the plan panel; needed only for each basket's on-paper result. */
  constituentsBySleeve: Map<string, SleeveConstituent[]>
  money: (value?: number) => string
  colors: string[]
}

/**
 * Taking money out is a rare action next to paying money in, so it stays folded away
 * behind a button rather than adding a permanent panel to a card people read monthly.
 */
export function WithdrawalGuide({ allocation, constituentsBySleeve, money, colors }: WithdrawalGuideProps) {
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [amountText, setAmountText] = useState('')

  const sleeveInputs = useMemo<WithdrawalSleeveInput[]>(() => allocation.sleeves.map(sleeve => {
    const constituents = constituentsBySleeve.get(sleeve.sleeve) ?? []
    const anyUnknown = constituents.some(holding => holding.unrealisedProfitLossApp === undefined)
    return {
      sleeve: sleeve.sleeve,
      label: sleeve.label,
      targetPercentage: sleeve.targetPercentage,
      value: sleeve.value ?? 0,
      unrealisedProfitLoss: anyUnknown
        ? undefined
        : constituents.reduce((sum, holding) => sum + (holding.unrealisedProfitLossApp ?? 0), 0),
    }
  }), [allocation.sleeves, constituentsBySleeve])

  const plan = useMemo(
    () => allocation.availableCash === undefined
      ? null
      : planWithdrawal(Number(amountText) || 0, allocation.availableCash, sleeveInputs),
    [amountText, allocation.availableCash, sleeveInputs],
  )

  const invested = allocation.investedValue ?? 0
  const cashKnown = allocation.availableCash !== undefined
  const canPlan = cashKnown && (invested > 0 || (allocation.availableCash ?? 0) > 0)

  const handleToggle = () => {
    if (!canPlan) return
    setOpen(value => !value)
  }

  return (
    <div
      className={`mt-5 rounded-control bg-surface-2/70 p-4 ${canPlan ? 'cursor-pointer' : ''}`}
      onClick={handleToggle}
      role="group"
      aria-label="Taking money out"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="hidden items-center gap-1 text-caption font-semibold text-foreground sm:flex">
          <HandCoins className="size-3.5 text-muted-foreground" /> Taking money out
          <InfoHint
            label="taking money out"
            align="left"
            text="Uses spare broker cash first, then baskets above target, to keep the mix balanced."
          />
        </h3>
        <Button
          variant="tertiary"
          size="sm"
          aria-expanded={open}
          onClick={e => { e.stopPropagation(); handleToggle() }}
          disabled={!canPlan}
          className="w-full justify-between sm:w-auto"
        >
          {open ? 'Hide' : 'Plan a withdrawal'}
          <ChevronDown className={`size-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {!canPlan && (
        <p className="mt-2 text-xs text-muted-foreground">
          {cashKnown ? 'There is nothing to withdraw yet.' : 'Cash exchange rate missing.'}
        </p>
      )}

      {open && canPlan && (
        <m.div
          initial={reduceMotion ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="mt-3">
            <label htmlFor="withdrawal-amount" className="block text-xs font-semibold text-muted-foreground">
              How much do you need?
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="shrink-0 text-caption font-semibold text-muted-foreground">{allocation.appCurrency}</span>
              <SmartAmountInput
                id="withdrawal-amount"
                value={amountText}
                onChange={event => setAmountText(maskCurrencyInput(event.target.value, amountText))}
                placeholder="0.00"
                aria-label={`Amount to withdraw in ${allocation.appCurrency}`}
              />
            </div>
          </div>

          {plan && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                {plan.fromCash > 0 && (
                  <Badge tone="success">
                    {money(plan.fromCash)} from spare cash — nothing to sell
                  </Badge>
                )}
                {plan.fromHoldings > 0 && (
                  <Badge tone="neutral">
                    {money(plan.fromHoldings)} raised by selling
                  </Badge>
                )}
              </div>

              {plan.shortfall > 0 && (
                <p className="rounded-lg border border-orange-500/30 bg-orange-500/8 p-2.5 text-xs text-orange-700 dark:text-orange-300">
                  {money(plan.shortfall)} short — everything you hold raises {money(plan.requested - plan.shortfall)}.
                </p>
              )}

              {plan.fromHoldings > 0 && (
                <>
                  <ul className="grid gap-2 sm:grid-cols-3">
                    {plan.sleeves.map((sleeve, index) => (
                      <li key={sleeve.sleeve} className="rounded-lg border border-border/50 bg-background/50 p-3">
                        <div className="flex items-center gap-2">
                          <span className={`size-2 shrink-0 rounded-full ${colors[index]}`} aria-hidden="true" />
                          <span className="min-w-0 truncate text-caption font-semibold text-foreground">{sleeve.label}</span>
                        </div>
                        <strong className="mt-2 block text-lg text-foreground">
                          {sleeve.amount > 0 ? money(sleeve.amount) : 'Leave alone'}
                        </strong>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Leaves {sleeve.projectedPercentage.toFixed(1)}%
                          {Math.abs(sleeve.projectedDriftPercentagePoints) >= 0.05
                            ? ` (${sleeve.projectedDriftPercentagePoints > 0 ? '+' : ''}${sleeve.projectedDriftPercentagePoints.toFixed(1)} off target)`
                            : ' (on target)'}
                        </p>
                        {sleeve.amount > 0 && sleeve.estimatedRealisedProfitLoss !== undefined && (
                          <p className={`mt-1 text-xs font-semibold ${sleeve.estimatedRealisedProfitLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                            {sleeve.estimatedRealisedProfitLoss >= 0 ? 'Gain' : 'Loss'} booked ≈ {money(Math.abs(sleeve.estimatedRealisedProfitLoss))}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>

                </>
              )}
            </div>
          )}
        </m.div>
      )}
    </div>
  )
}
