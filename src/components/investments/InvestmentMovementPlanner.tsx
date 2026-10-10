import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, WalletCards } from 'lucide-react'
import type { InvestmentAllocationOverview, InvestmentPortfolio } from '../../types'
import { formatCurrencyVal, maskCurrencyInput } from '../../lib/utils'
import { planDeposit, splitDepositFunding } from '../../lib/investmentDeposit'
import { planWithdrawal } from '../../lib/investmentWithdrawal'
import { buildEtfPlan } from '../../lib/investmentEtfPlan'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { Badge } from '../ui/Badge'

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
  const depositFunding = splitDepositFunding(requested, spareCash)

  const plan = useMemo(() => {
    if (!canPlan || requested <= 0) return null
    if (mode === 'deposit') {
      const deposit = planDeposit(requested, allocation.sleeves.map(sleeve => ({
        sleeve: sleeve.sleeve,
        label: sleeve.label,
        targetPercentage: sleeve.targetPercentage,
        value: sleeve.value,
      })))
      return deposit && {
        sleeves: deposit.sleeves,
        fromCash: depositFunding.fromCash,
        fromHoldings: 0,
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
  }, [allocation.sleeves, canPlan, depositFunding.fromCash, mode, requested, spareCash])

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
    <section className="border-t border-border/60">
      {/* A full-width row flush with the panel: the panel clips it, so its hover has no corners. */}
      <Button type="button" variant="tertiary" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-none px-5 py-3 text-left hover:bg-surface-2/60 sm:px-6">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted-foreground dark:bg-surface-3"><WalletCards className="size-4" aria-hidden="true" /></span>
          <span className="min-w-0">
            <span className="block text-body font-medium text-foreground">Plan money in or out</span>
            <span className="block truncate text-caption font-normal text-muted-foreground">Split a deposit or withdrawal across your baskets</span>
          </span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </Button>

      {open && <div className="space-y-4 px-5 pb-5 sm:px-6">
        <div role="group" aria-label="Investment movement type" className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
          {(['deposit', 'withdrawal'] as const).map(value => (
            <Button
              key={value}
              type="button"
              variant={mode === value ? 'secondary' : 'tertiary'}
              size="sm"
              aria-pressed={mode === value}
              onClick={() => { setMode(value); setAmountText('') }}
              className={`capitalize ${mode === value ? 'dark:bg-surface-3' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {value === 'deposit' ? <ArrowDownToLine className="size-3.5" /> : <ArrowUpFromLine className="size-3.5" />}
              {value}
            </Button>
          ))}
        </div>

        <label className="block text-label font-medium text-muted-foreground">
          {mode === 'deposit' ? 'How much do you want to invest?' : 'How much do you need to withdraw?'}
          <div className="mt-1.5 flex items-center gap-2"><span className="shrink-0 text-caption font-semibold">{allocation.appCurrency}</span><SmartAmountInput value={amountText} onChange={event => setAmountText(maskCurrencyInput(event.target.value, amountText))} placeholder="0.00" aria-label={`${mode === 'deposit' ? 'Amount to invest' : 'Amount to withdraw'} in ${allocation.appCurrency}`} /></div>
        </label>

        {!canPlan && <p className="rounded-control bg-surface-2/70 p-3 text-caption text-muted-foreground">{!valuesKnown || !cashKnown ? 'Update the missing market or cash exchange rate before using this planner.' : mode === 'deposit' ? 'Classify at least one investment into a plan basket first.' : 'There is nothing to withdraw yet.'}</p>}

        {plan && <>
          <div className="flex flex-wrap gap-2 text-caption">
            {mode === 'deposit' && <Badge tone="info">{money(requested)} to invest</Badge>}
            {plan.fromCash > 0 && <Badge tone="success">{money(plan.fromCash)} {mode === 'deposit' ? 'from spare broker cash' : 'spare broker cash'}</Badge>}
            {mode === 'deposit' && depositFunding.cashRemaining > 0 && <Badge tone="neutral">{money(depositFunding.cashRemaining)} broker cash remaining</Badge>}
            {mode === 'deposit' && depositFunding.newFundsRequired > 0 && <Badge tone="warning">{money(depositFunding.newFundsRequired)} new funds required</Badge>}
            {mode === 'withdrawal' && plan.fromHoldings > 0 && <Badge tone="neutral">{money(plan.fromHoldings)} raised by selling</Badge>}
          </div>
          {plan.shortfall > 0 && <p className="rounded-control bg-orange-500/8 p-2.5 text-caption text-orange-700 dark:text-orange-300">{money(plan.shortfall)} short.</p>}
          <ul className="grid gap-2 lg:grid-cols-3">
            {plan.sleeves.map((sleeve, index) => {
              const etfPlan = etfPlans.find(item => item.sleeve === sleeve.sleeve)
              return <li key={sleeve.sleeve} className="rounded-control bg-surface-2/70 p-3">
                <div className="flex items-center gap-2"><span className={`size-2 rounded-full ${colors[index]}`} /><strong className="text-caption text-foreground">{sleeve.label}</strong></div>
                <strong className="mt-2 block text-section tabular-nums text-foreground">{sleeve.amount > 0 ? money(sleeve.amount) : mode === 'deposit' ? 'Skip' : 'Leave alone'}</strong>
                <p className="text-caption text-muted-foreground">Leaves {sleeve.projectedPercentage.toFixed(1)}%</p>
                {etfPlan?.requiresChoice && <CustomSelect ariaLabel={`ETF for ${sleeve.label}`} value={selections[sleeve.sleeve] ?? ''} onChange={value => setSelections(previous => ({ ...previous, [sleeve.sleeve]: String(value) }))} options={[{ value: '', label: 'Choose an ETF' }, ...etfPlan.choices.map(choice => ({ value: choice.id, label: `${choice.symbol} · ${choice.currency}` }))]} className="mt-2 w-full" />}
                {etfPlan && etfPlan.lines.length > 0 && <ul className="mt-2 space-y-1.5 border-t border-border/40 pt-2">{etfPlan.lines.map(line => <li key={line.instrumentId} className="text-caption"><div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate font-semibold text-foreground">{line.symbol}</span><span className="shrink-0 font-semibold text-foreground">{masked ? '••••' : money(line.amountApp)}</span></div>{line.currency !== allocation.appCurrency.toUpperCase() && <div className="mt-0.5 flex items-start justify-between gap-2 text-muted-foreground"><span className="truncate">{line.currency}{line.fx?.asOf ? ` · FX ${line.fx.asOf}` : ''}</span><span className="shrink-0">{masked ? '••••' : line.amountNative === undefined ? 'Exchange rate unavailable' : `≈ ${formatCurrencyVal(line.amountNative, line.currency)}`}</span></div>}</li>)}</ul>}
              </li>
            })}
          </ul>
        </>}
      </div>}
    </section>
  )
}
