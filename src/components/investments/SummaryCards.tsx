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
  const priceMove = portfolio.summary.dailyPriceChange
  const currencyMove = portfolio.summary.dailyCurrencyChange
  // Rounding noise on a same-currency portfolio should not earn two rows saying nothing.
  const hasCurrencyMove = Math.abs(currencyMove ?? 0) >= 0.005
  const percent = portfolio.summary.unrealisedPercent
  const annualReturn = portfolio.summary.annualReturn

  const tone = (value?: number) => {
    // An unknown figure is quiet, not a warning: it is waiting on prices, nothing is wrong.
    if (value === undefined) return 'text-muted-foreground'
    if (value > 0) return 'text-emerald-600 dark:text-emerald-400'
    if (value < 0) return 'text-red-600 dark:text-red-400'
    return 'text-foreground'
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
      color: 'text-foreground',
    },
    undeployed !== undefined && undeployed < -0.005
      ? {
          label: 'More sent than set aside',
          value: format(Math.abs(undeployed)),
          hint: 'Your broker received more than you set aside in Growth.',
          color: 'text-muted-foreground',
        }
      : {
          label: 'Waiting to be sent',
          value: format(undeployed === undefined ? undefined : Math.max(0, undeployed)),
          hint: 'Earmarked money your broker has not received yet: what you set aside minus what you sent.',
          color: (undeployed ?? 0) > 0.005 ? 'text-foreground' : 'text-emerald-600 dark:text-emerald-400',
        },
    {
      label: 'Share sent',
      value: deployedPercent === undefined
        ? '—'
        : masked ? '••••' : `${deployedPercent.toFixed(0)}%`,
      hint: 'How much of the money set aside has reached your broker.',
      color: deployedPercent === undefined || deployedPercent >= 95 ? 'text-foreground' : 'text-amber-700 dark:text-amber-300',
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
      bg: '',
      hero: { label: 'Latest total', value: format(portfolio.summary.totalValue), color: portfolio.summary.totalValue === undefined ? 'text-muted-foreground' : 'text-foreground' },
      rows: [
        { label: 'Investments', value: format(portfolio.summary.marketValue), hint: 'Value of the shares and funds you hold, at their latest saved prices.' },
        { label: 'Broker cash', value: format(portfolio.summary.cashValue), hint: 'Money sitting uninvested in your broker accounts.' },
        { label: 'You paid', value: format(portfolio.summary.costBasis), hint: 'What the investments you still hold originally cost you.' },
      ],
    },
    {
      label: 'Money sent to broker',
      hint: 'Tracks money added to and withdrawn from your broker accounts.',
      bg: '',
      hero: { label: 'Deposits minus withdrawals', value: format(portfolio.summary.netDeposits), color: portfolio.summary.netDeposits === undefined ? 'text-muted-foreground' : 'text-foreground' },
      rows: moneyInRows,
    },
    {
      label: 'Profit and loss',
      hint: 'Your gain or loss so far: what is still on paper, plus what you have already banked.',
      bg: '',
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
      bg: '',
      hero: { label: 'Latest value move', value: signed(daily), color: tone(daily) },
      // A move stated in one currency cannot say whether the shares fell or the ringgit rose, and
      // those two regularly point opposite ways: a portfolio can be up on the year and report a
      // down day purely on the rate. The two parts add back to the move exactly, so the card can
      // show which one drove it. Only when the server sends them, and only when a rate is actually
      // involved — a single-currency portfolio has nothing to split.
      rows: [
        ...(priceMove !== undefined && currencyMove !== undefined && hasCurrencyMove
          ? [
              { label: 'From share prices', value: signed(priceMove), hint: 'The part of the move that was your funds’ own prices changing.', color: tone(priceMove) },
              { label: 'From currency', value: signed(currencyMove), hint: `The part of the move that was the rate between your funds’ currencies and ${currency} changing.`, color: tone(currencyMove) },
            ]
          : []),
        { label: 'Dividends received', value: format(portfolio.summary.netDividends), hint: 'Payouts your investments have paid you, after any tax withheld.' },
      ],
    },
  ]

  return (
    <section aria-label="Investment summary" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      {cards.map(({ label, hint, hero, rows, bg }, index) => (
        <article
          key={label}
          className={cn('list-card-enter', panelClass, 'flex flex-col p-5', bg)}
          style={index === 0 ? undefined : { animationDelay: `${index * 35}ms` }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-label font-medium text-muted-foreground">{label}</p>
            <InfoHint label={label} text={hint} />
          </div>
          <p className="mt-3 text-caption text-muted-foreground">{hero.label}</p>
          <strong className={`mt-0.5 block break-words text-title font-semibold tabular-nums ${hero.color ?? 'text-foreground'}`}>{hero.value}</strong>
          <div className="mt-4 divide-y divide-border/60 border-t border-border/60">
            {rows.map(row => (
              <div key={row.label} className="flex items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 items-center gap-0.5 text-label text-muted-foreground">
                  <span className="truncate">{row.label}</span>
                  <InfoHint label={row.label} text={row.hint} />
                </span>
                <strong className={`shrink-0 break-words text-right text-label font-semibold tabular-nums ${row.color ?? 'text-foreground'}`}>{row.value}</strong>
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  )
}
