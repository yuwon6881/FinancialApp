import type { InvestmentPortfolio } from '../../types'
import { InfoHint } from '../ui/InfoHint'
import { formatCurrencyVal } from '../../lib/utils'
import { cn } from '../../lib/utils'
import { panelClass } from '../ui/panelStyles'

const money = (value: number, currency: string) =>
  formatCurrencyVal(value, currency)

interface SummaryMetric {
  label: string
  value: string
  hint: string
  color?: string
}

export const SummaryCards = ({ portfolio, masked }: { portfolio: InvestmentPortfolio; masked: boolean }) => {
  const currency = portfolio.appCurrency
  const format = (value?: number) => value === undefined ? 'Not available yet' : masked ? '••••' : money(value, currency)
  const signed = (value?: number) => value === undefined
    ? 'Not available yet'
    : masked ? '••••' : `${value > 0 ? '+' : ''}${money(value, currency)}`
  const unrealised = portfolio.summary.unrealisedProfitLoss
  const realised = portfolio.summary.realisedProfitLoss
  const daily = portfolio.summary.dailyChange
  const percent = portfolio.summary.unrealisedPercent
  const annualReturn = portfolio.summary.annualReturn

  const tone = (value?: number) => {
    if (value === undefined) return 'text-amber-500'
    if (value > 0) return 'text-emerald-500'
    if (value < 0) return 'text-orange-500'
    return 'text-foreground'
  }
  const cardTone = (value?: number) => {
    if (value === undefined || value === 0) return 'bg-card/92 border-border/60'
    return value > 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-orange-500/5 border-orange-500/20'
  }

  const earmarked = portfolio.summary.growthContributions ?? 0
  const sentToBroker = portfolio.summary.netDeposits
  const undeployed = sentToBroker === undefined ? undefined : earmarked - sentToBroker
  const deployedPercent = sentToBroker === undefined || earmarked <= 0
    ? undefined
    : Math.max(0, Math.min(999, sentToBroker / earmarked * 100))
  const moneyInRows: SummaryMetric[] = [
    {
      label: 'Set aside to invest',
      value: format(earmarked),
      hint: 'Total your budget has earmarked for investing so far.',
      color: 'text-blue-500',
    },
    undeployed !== undefined && undeployed < -0.005
      ? {
          label: 'More sent than set aside',
          value: format(Math.abs(undeployed)),
          hint: 'Your broker received more than you set aside in Growth.',
          color: 'text-amber-500',
        }
      : {
          label: 'Waiting to be sent',
          value: format(undeployed === undefined ? undefined : Math.max(0, undeployed)),
          hint: 'Earmarked money your broker has not received yet: what you set aside minus what you sent.',
          color: (undeployed ?? 0) > 0.005 ? 'text-foreground' : 'text-emerald-500',
        },
    {
      label: 'Share sent',
      value: deployedPercent === undefined
        ? '—'
        : masked ? '••••' : `${deployedPercent.toFixed(0)}%`,
      hint: 'How much of the money set aside has reached your broker.',
      color: deployedPercent === undefined || deployedPercent >= 95 ? 'text-foreground' : 'text-amber-500',
    },
  ]

  const cards: Array<{
    label: string
    hint: string
    bg: string
    hero: { label: string; value: string; color?: string }
    rows: SummaryMetric[]
  }> = [
    {
      label: 'What it is worth',
      hint: `Latest saved value of your investments and broker cash, shown in ${currency}.`,
      bg: 'bg-card/92 border-border/60',
      hero: { label: 'Latest total', value: format(portfolio.summary.totalValue), color: portfolio.summary.totalValue === undefined ? 'text-amber-500' : 'text-foreground' },
      rows: [
        { label: 'Investments', value: format(portfolio.summary.marketValue), hint: 'Value of the shares and funds you hold, at their latest saved prices.' },
        { label: 'Broker cash', value: format(portfolio.summary.cashValue), hint: 'Money sitting uninvested in your broker accounts.' },
        { label: 'You paid', value: format(portfolio.summary.costBasis), hint: 'What the investments you still hold originally cost you.' },
      ],
    },
    {
      label: 'Money sent to broker',
      hint: 'Tracks money added to and withdrawn from your broker accounts.',
      bg: 'bg-blue-500/5 border-blue-500/20',
      hero: { label: 'Deposits minus withdrawals', value: format(portfolio.summary.netDeposits), color: portfolio.summary.netDeposits === undefined ? 'text-amber-500' : 'text-foreground' },
      rows: moneyInRows,
    },
    {
      label: 'Profit and loss',
      hint: 'Your gain or loss so far: what is still on paper, plus what you have already banked.',
      bg: cardTone(unrealised),
      hero: {
        label: 'On paper',
        value: unrealised === undefined || masked
          ? signed(unrealised)
          : `${signed(unrealised)} · ${(percent ?? 0) > 0 ? '+' : ''}${(percent ?? 0).toFixed(1)}%`,
        color: tone(unrealised),
      },
      rows: [
        { label: 'Already banked', value: signed(realised), hint: 'Profit or loss locked in on investments you have sold, after fees and taxes.', color: tone(realised) },
        {
          label: 'Yearly return',
          value: annualReturn === undefined ? 'Not available yet' : masked ? '••••' : `${annualReturn > 0 ? '+' : ''}${(annualReturn * 100).toFixed(1)}% a year`,
          hint: 'Average yearly return, adjusted for when each deposit went in.',
          color: annualReturn === undefined ? undefined : tone(annualReturn),
        },
      ],
    },
    {
      label: 'Income and latest move',
      hint: 'Dividends received, plus the move between the two latest saved market values. It may be from an earlier market day.',
      bg: cardTone(daily),
      hero: { label: 'Latest value move', value: signed(daily), color: tone(daily) },
      rows: [
        { label: 'Dividends received', value: format(portfolio.summary.netDividends), hint: 'Payouts your investments have paid you, after any tax withheld.' },
      ],
    },
  ]

  return (
    <section aria-label="Investment summary" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      {cards.map(({ label, hint, hero, rows, bg }, index) => (
        <article
          key={label}
          className={cn('list-card-enter interactive-card', panelClass, 'flex flex-col p-4', bg)}
          style={index === 0 ? undefined : { animationDelay: `${index * 35}ms` }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
            <InfoHint label={label} text={hint} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{hero.label}</p>
          <strong className={`block break-words text-xl font-black leading-tight ${hero.color ?? 'text-foreground'}`}>{hero.value}</strong>
          <div className="mt-3 divide-y divide-border/40 border-t border-border/40 pt-1">
            {rows.map(row => (
              <div key={row.label} className="flex items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 items-center gap-0.5 text-xs text-muted-foreground">
                  <span className="truncate">{row.label}</span>
                  <InfoHint label={row.label} text={row.hint} />
                </span>
                <strong className={`shrink-0 break-words text-right text-sm ${row.color ?? 'text-foreground'}`}>{row.value}</strong>
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  )
}
