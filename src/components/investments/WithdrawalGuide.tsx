import { useMemo, useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { ChevronDown, HandCoins } from 'lucide-react'
import type { InvestmentAllocationOverview } from '../../types'
import { Button } from '../ui/Button'
import { InfoHint } from '../ui/InfoHint'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { planWithdrawal, type WithdrawalSleeveInput } from '../../lib/investmentWithdrawal'
import type { SleeveConstituent } from '../../lib/investmentSleeveBreakdown'

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
    () => planWithdrawal(Number(amountText) || 0, allocation.availableCash, sleeveInputs),
    [amountText, allocation.availableCash, sleeveInputs],
  )

  const invested = allocation.investedValue ?? 0
  const canPlan = invested > 0 || allocation.availableCash > 0

  return (
    <div className="mt-5 rounded-xl border border-border/50 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="hidden items-center gap-1 text-xs font-bold text-foreground sm:flex">
          <HandCoins className="size-3.5 text-muted-foreground" /> Taking money out
          <InfoHint
            label="taking money out"
            align="left"
            text="Uses spare broker cash first, then baskets above target, to keep the mix balanced."
          />
        </h3>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen(value => !value)}
          disabled={!canPlan}
          className="w-full justify-between sm:w-auto"
        >
          {open ? 'Hide' : 'Plan a withdrawal'}
          <ChevronDown className={`size-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {!canPlan && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          There is nothing to withdraw yet.
        </p>
      )}

      {open && canPlan && (
        <m.div
          initial={reduceMotion ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="mt-3">
            <label htmlFor="withdrawal-amount" className="block text-[11px] font-semibold text-muted-foreground">
              How much do you need?
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="shrink-0 text-xs font-bold text-muted-foreground">{allocation.appCurrency}</span>
              <SmartAmountInput
                id="withdrawal-amount"
                value={amountText}
                onChange={event => setAmountText(event.target.value)}
                placeholder="0.00"
                aria-label={`Amount to withdraw in ${allocation.appCurrency}`}
              />
            </div>
          </div>

          {plan && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2 text-[10px]">
                {plan.fromCash > 0 && (
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/8 px-2 py-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                    {money(plan.fromCash)} from spare cash — nothing to sell
                  </span>
                )}
                {plan.fromHoldings > 0 && (
                  <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 font-bold text-muted-foreground">
                    {money(plan.fromHoldings)} raised by selling
                  </span>
                )}
              </div>

              {plan.shortfall > 0 && (
                <p className="rounded-lg border border-orange-500/30 bg-orange-500/8 p-2.5 text-[11px] text-orange-700 dark:text-orange-300">
                  You are {money(plan.shortfall)} short. Selling everything you hold plus all spare
                  cash raises {money(plan.requested - plan.shortfall)}.
                </p>
              )}

              {plan.fromHoldings > 0 && (
                <>
                  <ul className="grid gap-2 sm:grid-cols-3">
                    {plan.sleeves.map((sleeve, index) => (
                      <li key={sleeve.sleeve} className="rounded-lg border border-border/50 bg-background/50 p-3">
                        <div className="flex items-center gap-2">
                          <span className={`size-2 shrink-0 rounded-full ${colors[index]}`} aria-hidden="true" />
                          <span className="min-w-0 truncate text-[11px] font-bold text-foreground">{sleeve.label}</span>
                        </div>
                        <strong className="mt-2 block text-lg text-foreground">
                          {sleeve.amount > 0 ? money(sleeve.amount) : 'Leave alone'}
                        </strong>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {sleeve.amount > 0
                            ? `${sleeve.percentageOfBasket.toFixed(1)}% of this basket · leaves you at ${sleeve.projectedPercentage.toFixed(1)}%`
                            : `Stays as it is · leaves you at ${sleeve.projectedPercentage.toFixed(1)}%`}
                          {Math.abs(sleeve.projectedDriftPercentagePoints) >= 0.05
                            ? ` (${sleeve.projectedDriftPercentagePoints > 0 ? '+' : ''}${sleeve.projectedDriftPercentagePoints.toFixed(1)} off target)`
                            : ' (on target)'}
                        </p>
                        {sleeve.amount > 0 && sleeve.estimatedRealisedProfitLoss !== undefined && (
                          <p className={`mt-1 text-[10px] font-semibold ${sleeve.estimatedRealisedProfitLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                            About {money(Math.abs(sleeve.estimatedRealisedProfitLoss))}{' '}
                            {sleeve.estimatedRealisedProfitLoss >= 0 ? 'gain' : 'loss'} moves from on paper to already banked
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>

                  <details className="rounded-lg border border-border/50 bg-background/40 p-3">
                    <summary className="cursor-pointer text-[11px] font-semibold text-foreground">
                      Why these baskets?
                    </summary>
                    <div className="mt-2 space-y-2 text-[10px] leading-relaxed text-muted-foreground">
                      <p>
                        The money comes out of whichever baskets are holding more than their share of
                        what will be left, so the withdrawal tidies your mix on the way out instead of
                        pulling it further away. After this you would be {money(plan.projectedTotal)} invested,
                        {plan.worstProjectedDrift < 0.05
                          ? ' exactly on your target mix.'
                          : ` at most ${plan.worstProjectedDrift.toFixed(1)} percentage points from your target mix.`}
                      </p>
                      <p>
                        Gains and losses are shown but do not decide the order. Picking what to sell by
                        gain or loss is a tax decision that depends on your country and on which exact
                        purchases your broker sells — this app tracks neither, and choosing that way
                        usually leaves your mix further off target.
                        {plan.estimatedRealisedProfitLoss !== undefined && (
                          <> Across all baskets this sale turns about {money(Math.abs(plan.estimatedRealisedProfitLoss))}{' '}
                          {plan.estimatedRealisedProfitLoss >= 0 ? 'of gains' : 'of losses'} from on paper into already banked.</>
                        )}
                      </p>
                      <p>
                        These are estimates based on the latest prices you have. Your broker's own
                        figures at the moment you sell are the real ones.
                      </p>
                    </div>
                  </details>
                </>
              )}
            </div>
          )}
        </m.div>
      )}
    </div>
  )
}
