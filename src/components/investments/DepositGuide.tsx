import { useMemo, useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { ChevronDown, PiggyBank } from 'lucide-react'
import type { InvestmentAllocationOverview } from '../../types'
import { Button } from '../ui/Button'
import { InfoHint } from '../ui/InfoHint'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { planDeposit, type DepositSleeveInput } from '../../lib/investmentDeposit'

interface DepositGuideProps {
  allocation: InvestmentAllocationOverview
  money: (value?: number) => string
  colors: string[]
}

/**
 * Interactive deposit planning panel — the mirror of WithdrawalGuide.
 *
 * Lets you ask "if I put in X, how would it be split?" for any custom amount.
 */
export function DepositGuide({ allocation, money, colors }: DepositGuideProps) {
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [amountText, setAmountText] = useState('')

  const sleeveInputs = useMemo<DepositSleeveInput[]>(() =>
    allocation.sleeves.map(sleeve => ({
      sleeve: sleeve.sleeve,
      label: sleeve.label,
      targetPercentage: sleeve.targetPercentage,
      value: sleeve.value,
    })), [allocation.sleeves])

  const plan = useMemo(
    () => planDeposit(Number(amountText) || 0, sleeveInputs),
    [amountText, sleeveInputs],
  )

  const canPlan = (allocation.investedValue !== undefined) || sleeveInputs.some(s => (s.value ?? 0) > 0)

  const handleToggle = () => {
    if (!canPlan) return
    setOpen(value => !value)
  }

  return (
    <div
      className={`mt-5 rounded-xl border border-border/50 bg-muted/20 p-4 transition-all duration-300 hover:border-primary/20 hover:bg-muted/30 hover:shadow-sm ${canPlan ? 'cursor-pointer' : ''}`}
      onClick={handleToggle}
      role="group"
      aria-label="Putting money in"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="hidden items-center gap-1 text-xs font-bold text-foreground sm:flex">
          <PiggyBank className="size-3.5 text-muted-foreground" /> Putting money in
          <InfoHint
            label="putting money in"
            align="left"
            text="Larger gaps receive more so your deposit rebalances the mix without selling anything."
          />
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={e => { e.stopPropagation(); handleToggle() }}
            disabled={!canPlan}
            className="w-full justify-between sm:w-auto"
          >
            {open ? 'Hide' : 'Plan a deposit'}
            <ChevronDown className={`size-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </div>

      {!canPlan && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          There is nothing to plan against yet — add holdings first.
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
            <label htmlFor="deposit-amount" className="block text-[11px] font-semibold text-muted-foreground">
              How much do you want to put in?
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="shrink-0 text-xs font-bold text-muted-foreground">{allocation.appCurrency}</span>
              <SmartAmountInput
                id="deposit-amount"
                value={amountText}
                onChange={event => setAmountText(event.target.value)}
                placeholder="0.00"
                aria-label={`Amount to deposit in ${allocation.appCurrency}`}
              />
            </div>
          </div>

          {plan && (
            <div className="mt-4 space-y-3">
              <ul className="grid gap-2 sm:grid-cols-3">
                {plan.sleeves.map((sleeve, index) => (
                  <li key={sleeve.sleeve} className="rounded-lg border border-border/50 bg-background/50 p-3">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 shrink-0 rounded-full ${colors[index]}`} aria-hidden="true" />
                      <span className="min-w-0 truncate text-[11px] font-bold text-foreground">{sleeve.label}</span>
                    </div>
                    <strong className="mt-2 block text-lg text-foreground">
                      {sleeve.amount > 0 ? money(sleeve.amount) : 'Skip'}
                    </strong>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {sleeve.amount > 0
                        ? `${sleeve.percentageOfDeposit.toFixed(1)}% of this deposit · leaves you at ${sleeve.projectedPercentage.toFixed(1)}%`
                        : `Already on target · stays at ${sleeve.projectedPercentage.toFixed(1)}%`}
                      {Math.abs(sleeve.projectedDriftPercentagePoints) >= 0.05
                        ? ` (${sleeve.projectedDriftPercentagePoints > 0 ? '+' : ''}${sleeve.projectedDriftPercentagePoints.toFixed(1)} off target)`
                        : ' (on target)'}
                    </p>
                  </li>
                ))}
              </ul>

              <details className="rounded-lg border border-border/50 bg-background/40 p-3">
                <summary className="cursor-pointer text-[11px] font-semibold text-foreground">
                  Why these amounts?
                </summary>
                <div className="mt-2 space-y-2 text-[10px] leading-relaxed text-muted-foreground">
                  <p>
                    Each basket gets as much of the deposit as it needs to reach its target share of
                    the new total. Whichever basket is furthest below its slice receives the most,
                    so the deposit tidies your mix on the way in instead of pulling it further away.
                    After this you would be {money(plan.projectedTotal)} invested,
                    {plan.worstProjectedDrift < 0.05
                      ? ' exactly on your target mix.'
                      : ` at most ${plan.worstProjectedDrift.toFixed(1)} percentage points from your target mix.`}
                  </p>
                  <p>
                    These are estimates based on the latest prices you have. Your broker's actual
                    figures at the time you invest are the real ones.
                  </p>
                </div>
              </details>
            </div>
          )}
        </m.div>
      )}
    </div>
  )
}
