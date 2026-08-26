import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, WalletCards } from 'lucide-react'
import type { InvestmentAllocationOverview, InvestmentPortfolio } from '../../types'
import { formatCurrencyVal } from '../../lib/utils'
import { planDeposit } from '../../lib/investmentDeposit'
import { planWithdrawal } from '../../lib/investmentWithdrawal'
import { buildEtfPlan } from '../../lib/investmentEtfPlan'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { SmartAmountInput } from '../ui/SmartAmountInput'

interface Props {
  allocation: InvestmentAllocationOverview
  holdings: InvestmentPortfolio['holdings']
  instruments: InvestmentPortfolio['instruments']
  fxRates: NonNullable<InvestmentPortfolio['planFxRates']>
  masked: boolean
  money: (value?: number) => string
  colors: string[]
}

export function InvestmentMovementPlanner({ allocation, holdings, instruments, fxRates, masked, money, colors }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'deposit' | 'withdrawal'>('deposit')
  const [amountText, setAmountText] = useState('')
  const [selections, setSelections] = useState<Record<string, string>>({})
  const requested = Number(amountText) || 0
  const assignedInstruments = instruments.filter(instrument => !instrument.isArchived && instrument.allocationSleeve)
  const valuesKnown = allocation.sleeves.every(sleeve => sleeve.value !== undefined)
  const cashKnown = allocation.availableCash !== undefined
  const invested = allocation.investedValue ?? 0
  const canDeposit = valuesKnown && cashKnown && assignedInstruments.length > 0
  const canWithdraw = valuesKnown && cashKnown && (invested > 0 || (allocation.availableCash ?? 0) > 0)
  const canPlan = mode === 'deposit' ? canDeposit : canWithdraw
  const spareCash = Math.max(0, allocation.availableCash ?? 0)

  const plan = useMemo(() => {
    if (!canPlan || requested <= 0) return null
    if (mode === 'deposit') {
      const totalReady = requested + spareCash
      const deposit = planDeposit(totalReady, allocation.sleeves.map(sleeve => ({
        sleeve: sleeve.sleeve,
        label: sleeve.label,
        targetPercentage: sleeve.targetPercentage,
        value: sleeve.value,
      })))
      return deposit && {
        sleeves: deposit.sleeves,
        fromCash: spareCash,
        fromHoldings: totalReady,
        shortfall: 0,
        projectedTotal: deposit.projectedTotal,
        worstProjectedDrift: deposit.worstProjectedDrift,
      }
    }
    const withdrawal = planWithdrawal(requested, spareCash, allocation.sleeves.map(sleeve => ({
      sleeve: sleeve.sleeve,
      label: sleeve.label,
      targetPercentage: sleeve.targetPercentage,
      value: sleeve.value ?? 0,
    })))
    return withdrawal && {
      sleeves: withdrawal.sleeves,
      fromCash: withdrawal.fromCash,
      fromHoldings: withdrawal.fromHoldings,
      shortfall: withdrawal.shortfall,
      projectedTotal: withdrawal.projectedTotal,
      worstProjectedDrift: withdrawal.worstProjectedDrift,
    }
  }, [allocation.sleeves, canPlan, mode, requested, spareCash])

  const etfPlans = useMemo(() => plan ? buildEtfPlan(
    plan.sleeves.map(sleeve => ({ sleeve: sleeve.sleeve, amount: sleeve.amount })),
    mode,
    allocation.appCurrency,
    holdings,
    instruments,
    fxRates,
    selections,
  ) : [], [allocation.appCurrency, fxRates, holdings, instruments, mode, plan, selections])

  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-border/60 bg-muted/20">
      <Button type="button" variant="unstyled" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-none px-4 py-3 text-left transition hover:bg-muted/30">
        <span className="flex min-w-0 items-center gap-2.5"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-500"><WalletCards className="size-4" /></span><span><strong className="block text-xs text-foreground">Plan money in or out</strong><span className="block text-[10px] text-muted-foreground">See the app-currency plan and each ETF’s trading-currency equivalent.</span></span></span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && <div className="space-y-4 border-t border-border/50 p-4">
        <div role="group" aria-label="Investment movement type" className="grid grid-cols-2 rounded-lg border border-border/60 bg-background/50 p-1">
          {(['deposit', 'withdrawal'] as const).map(value => (
            <Button
              key={value}
              type="button"
              variant={mode === value ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={mode === value}
              onClick={() => { setMode(value); setAmountText('') }}
              className={`min-h-11 capitalize sm:min-h-9 ${mode === value ? '' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {value === 'deposit' ? <ArrowDownToLine className="size-3.5" /> : <ArrowUpFromLine className="size-3.5" />}
              {value}
            </Button>
          ))}
        </div>

        <label className="block text-[11px] font-semibold text-muted-foreground">
          {mode === 'deposit' ? 'How much new money do you want to deposit?' : 'How much do you need to withdraw?'}
          <div className="mt-1.5 flex items-center gap-2"><span className="shrink-0 text-xs font-bold">{allocation.appCurrency}</span><SmartAmountInput value={amountText} onChange={event => setAmountText(event.target.value)} placeholder="0.00" aria-label={`${mode === 'deposit' ? 'Amount to deposit' : 'Amount to withdraw'} in ${allocation.appCurrency}`} /></div>
        </label>

        {!canPlan && <p className="rounded-lg border border-orange-500/25 bg-orange-500/8 p-3 text-[11px] text-orange-700 dark:text-orange-300">{!valuesKnown || !cashKnown ? 'Update the missing market or cash exchange rate before using this planner.' : mode === 'deposit' ? 'Classify at least one investment into a plan basket first.' : 'There is nothing to withdraw yet.'}</p>}

        {plan && <>
          <div className="flex flex-wrap gap-2 text-[10px]">
            {mode === 'deposit' && <span className="rounded-full border border-blue-500/25 bg-blue-500/8 px-2 py-1 font-bold text-blue-600 dark:text-blue-400">{money(requested)} new deposit</span>}
            {plan.fromCash > 0 && <span className="rounded-full border border-emerald-500/25 bg-emerald-500/8 px-2 py-1 font-bold text-emerald-600 dark:text-emerald-400">{money(plan.fromCash)} spare broker cash</span>}
            {mode === 'withdrawal' && plan.fromHoldings > 0 && <span className="rounded-full border border-border/60 bg-background/60 px-2 py-1 font-bold text-muted-foreground">{money(plan.fromHoldings)} raised by selling</span>}
          </div>
          {plan.shortfall > 0 && <p className="rounded-lg border border-orange-500/30 bg-orange-500/8 p-2.5 text-[11px] text-orange-700 dark:text-orange-300">You are {money(plan.shortfall)} short after using all spare cash and holdings.</p>}
          <ul className="grid gap-2 lg:grid-cols-3">
            {plan.sleeves.map((sleeve, index) => {
              const etfPlan = etfPlans.find(item => item.sleeve === sleeve.sleeve)
              return <li key={sleeve.sleeve} className="rounded-xl border border-border/50 bg-background/55 p-3">
                <div className="flex items-center gap-2"><span className={`size-2 rounded-full ${colors[index]}`} /><strong className="text-[11px] text-foreground">{sleeve.label}</strong></div>
                <strong className="mt-2 block text-lg text-foreground">{sleeve.amount > 0 ? money(sleeve.amount) : mode === 'deposit' ? 'Skip' : 'Leave alone'}</strong>
                <p className="text-[10px] text-muted-foreground">Leaves this basket at {sleeve.projectedPercentage.toFixed(1)}%.</p>
                {etfPlan?.requiresChoice && <CustomSelect ariaLabel={`ETF for ${sleeve.label}`} value={selections[sleeve.sleeve] ?? ''} onChange={value => setSelections(previous => ({ ...previous, [sleeve.sleeve]: String(value) }))} options={[{ value: '', label: 'Choose an ETF' }, ...etfPlan.choices.map(choice => ({ value: choice.id, label: `${choice.symbol} · ${choice.currency}` }))]} className="mt-2 w-full" />}
                {etfPlan && etfPlan.lines.length > 0 && <ul className="mt-2 space-y-1.5 border-t border-border/40 pt-2">{etfPlan.lines.map(line => <li key={line.instrumentId} className="text-[10px]"><div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate font-bold text-foreground">{line.symbol}</span><span className="shrink-0 font-bold text-foreground">{masked ? '••••' : money(line.amountApp)}</span></div>{line.currency !== allocation.appCurrency.toUpperCase() && <div className="mt-0.5 flex items-start justify-between gap-2 text-muted-foreground"><span className="truncate">{line.currency}{line.fx?.asOf ? ` · FX ${line.fx.asOf}` : ''}</span><span className="shrink-0">{masked ? '••••' : line.amountNative === undefined ? 'Exchange rate unavailable' : `≈ ${formatCurrencyVal(line.amountNative, line.currency)}`}</span></div>}</li>)}</ul>}
              </li>
            })}
          </ul>
          <details className="rounded-lg border border-border/50 bg-background/40 p-3"><summary className="cursor-pointer text-[11px] font-semibold text-foreground">How this is calculated</summary><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Basket amounts rebalance toward your saved target. Multiple ETFs keep their current value proportions. Native equivalents use the latest available rate where one unit of ETF currency equals the shown rate in {allocation.appCurrency}; your broker’s execution rate remains authoritative.</p></details>
        </>}
      </div>}
    </section>
  )
}
