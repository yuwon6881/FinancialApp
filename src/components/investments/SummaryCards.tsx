import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { InvestmentPortfolio } from '../../types'
import { InfoHint } from '../ui/InfoHint'
import { AmountText } from '../ui/AmountText'
import { Button } from '../ui/Button'
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

const positiveTone = 'text-emerald-600 dark:text-emerald-400'
const negativeTone = 'text-red-600 dark:text-red-400'

/**
 * The investments hero: what it is worth as the page's one large figure, the gain and the latest
 * move as one quiet line under it, and three facts in an aligned strip. Every other figure lives in
 * the breakdown below -- always open where there is room for it, one tap away on a phone, where
 * four groups of label/value rows used to push the actions a full screen down.
 */
export const SummaryCards = ({ portfolio, masked, actions }: {
  portfolio: InvestmentPortfolio
  masked: boolean
  /** The page's record and refresh actions, set at the foot of the hero. */
  actions?: ReactNode
}) => {
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const breakdownId = useId()
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
  const totalValue = portfolio.summary.totalValue

  const tone = (value?: number) => {
    // An unknown figure is quiet, not a warning: it is waiting on prices, nothing is wrong.
    if (value === undefined) return 'text-muted-foreground'
    if (value > 0) return positiveTone
    if (value < 0) return negativeTone
    return 'text-foreground'
  }

  const earmarked = portfolio.summary.growthContributions ?? 0
  const sentToBroker = portfolio.summary.netDeposits
  const undeployed = sentToBroker === undefined ? undefined : earmarked - sentToBroker
  const deployedPercent = sentToBroker === undefined || earmarked <= 0
    ? undefined
    : Math.max(0, Math.min(999, sentToBroker / earmarked * 100))

  const groups: Array<{ label: string; hint: string; rows: SummaryMetric[] }> = [
    {
      label: 'Money sent to broker',
      hint: 'Tracks money added to and withdrawn from your broker accounts.',
      rows: [
        { label: 'Deposits minus withdrawals', value: format(sentToBroker), hint: 'Everything you sent to your broker accounts, less what you took back out.', color: sentToBroker === undefined ? 'text-muted-foreground' : undefined },
        {
          label: 'Set aside to invest',
          value: format(earmarked),
          hint: 'Total your budget has earmarked for investing so far.',
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
              color: (undeployed ?? 0) > 0.005 ? 'text-foreground' : positiveTone,
            },
        {
          label: 'Share sent',
          value: deployedPercent === undefined
            ? '—'
            : masked ? '••••' : `${deployedPercent.toFixed(0)}%`,
          hint: 'How much of the money set aside has reached your broker.',
          color: deployedPercent === undefined || deployedPercent >= 95 ? 'text-foreground' : 'text-amber-700 dark:text-amber-300',
        },
      ],
    },
    {
      label: 'Profit and loss',
      hint: 'Your gain or loss so far: what is still on paper, plus what you have already banked.',
      rows: [
        {
          label: 'On paper',
          value: unrealised === undefined || masked
            ? signed(unrealised)
            : `${signed(unrealised)} · ${(percent ?? 0) > 0 ? '+' : ''}${(percent ?? 0).toFixed(1)}%`,
          hint: 'Profit or loss on what you still hold, at the latest saved prices.',
          color: tone(unrealised),
        },
        { label: 'Already banked', value: signed(realised), hint: 'Profit or loss locked in on investments you have sold, after fees and taxes.', color: tone(realised) },
        {
          label: 'Yearly return',
          value: annualReturn === undefined ? 'Not available yet' : masked ? '••••' : `${annualReturn > 0 ? '+' : ''}${(annualReturn * 100).toFixed(1)}% a year`,
          hint: 'Average yearly return, adjusted for when each deposit went in.',
          color: tone(annualReturn),
        },
      ],
    },
    {
      label: 'Income and latest move',
      hint: 'Dividends received, plus the move between the two latest saved market values. It may be from an earlier market day.',
      // A move stated in one currency cannot say whether the shares fell or the ringgit rose, and
      // those two regularly point opposite ways: a portfolio can be up on the year and report a
      // down day purely on the rate. The two parts add back to the move exactly, so the card can
      // show which one drove it. Only when the server sends them, and only when a rate is actually
      // involved — a single-currency portfolio has nothing to split.
      rows: [
        { label: 'Latest value move', value: signed(daily), hint: 'The move between the two latest saved market values.', color: tone(daily) },
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

  // The three facts that say what the total is made of. They replace the old "Made up of" group
  // rather than repeating it, so each figure appears once on the page.
  const facts: Array<{ label: string; value?: number; hint: string }> = [
    { label: 'Investments', value: portfolio.summary.marketValue, hint: 'Value of the shares and funds you hold, at their latest saved prices.' },
    { label: 'Broker cash', value: portfolio.summary.cashValue, hint: 'Money sitting uninvested in your broker accounts.' },
    { label: 'You paid', value: portfolio.summary.costBasis, hint: 'What the investments you still hold originally cost you.' },
  ]

  const gainPercent = percent === undefined ? '' : ` · ${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`

  return (
    <section aria-label="Investment summary" className={cn('list-card-enter @container overflow-hidden', panelClass)}>
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-1">
          <h2 className="text-label text-muted-foreground">What it is worth</h2>
          <InfoHint label="What it is worth" text={`Latest saved value of your investments and broker cash, shown in ${currency}.`} />
        </div>
        <div data-testid="investment-total" className="mt-1 min-w-0">
          {totalValue === undefined
            ? <p className="text-title text-muted-foreground">Not available yet</p>
            : <AmountText animate value={totalValue} currency={currency} isMasked={masked} className="text-display text-foreground @xs:text-hero" />}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-label text-muted-foreground">
          <span>Latest total</span>
          {/* Unknown figures stay in the breakdown; the headline line only carries real ones. */}
          {unrealised !== undefined && (
            <span>
              <span className={cn('font-semibold tabular-nums', masked ? 'text-foreground' : tone(unrealised))}>
                {masked ? '••••' : `${signed(unrealised)}${gainPercent}`}
              </span> on paper
            </span>
          )}
          {daily !== undefined && (
            <span><span className={cn('font-semibold tabular-nums', masked ? 'text-foreground' : tone(daily))}>{signed(daily)}</span> latest move</span>
          )}
          {totalValue === undefined && <span>Waiting on prices or an exchange rate</span>}
        </p>

        <dl className="mt-5 grid grid-cols-1 divide-y divide-border/50 rounded-control bg-surface-2/70 px-3.5 @md:grid-cols-3 @md:divide-x @md:divide-y-0 @md:px-0 @md:py-3">
          {facts.map(fact => (
            <div key={fact.label} className="flex min-h-10 min-w-0 items-center justify-between gap-3 py-2 @md:block @md:min-h-0 @md:px-4 @md:py-0">
              <dt className="flex min-w-0 items-center gap-0.5 text-label text-muted-foreground @md:text-caption">
                <span className="truncate">{fact.label}</span>
                <span className="hidden @md:inline-flex"><InfoHint label={fact.label} text={fact.hint} /></span>
              </dt>
              <dd className="min-w-0 shrink-0 text-label font-semibold text-foreground @md:mt-0.5 @md:truncate @md:text-body">
                {fact.value === undefined
                  ? <span className="font-normal text-muted-foreground" title="Not available yet">—<span className="sr-only">Not available yet</span></span>
                  : <AmountText value={fact.value} currency={currency} isMasked={masked} />}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Below the expanded tier the breakdown is one tap away; at it there is room to leave it open. */}
      <Button
        variant="tertiary"
        aria-expanded={breakdownOpen}
        aria-controls={breakdownId}
        onClick={() => setBreakdownOpen(value => !value)}
        className="flex w-full justify-between rounded-none border-x-0 border-b-0 border-t border-t-border/60 px-5 text-muted-foreground hover:text-foreground sm:px-6 lg:hidden"
      >
        <span>{breakdownOpen ? 'Hide breakdown' : 'Show breakdown'}</span>
        <ChevronDown className={cn('size-4 transition-transform duration-200', breakdownOpen && 'rotate-180')} aria-hidden="true" />
      </Button>
      <div
        id={breakdownId}
        className={cn(
          'gap-x-8 gap-y-5 border-t border-border/60 px-5 py-4 sm:px-6 lg:grid lg:grid-cols-3 lg:py-5',
          breakdownOpen ? 'grid' : 'hidden',
        )}
      >
        {groups.map(({ label, hint, rows }) => (
          <div key={label} className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="text-label font-medium text-foreground">{label}</h3>
              <InfoHint label={label} text={hint} />
            </div>
            <dl className="mt-1 divide-y divide-border/50">
              {rows.map(row => (
                <div key={row.label} className="flex min-h-10 items-center justify-between gap-3 py-0.5">
                  <dt className="flex min-w-0 items-center gap-0.5 text-label text-muted-foreground">
                    <span className="truncate">{row.label}</span>
                    <InfoHint label={row.label} text={row.hint} />
                  </dt>
                  <dd className={cn('shrink-0 text-right text-label font-semibold tabular-nums', row.color ?? 'text-foreground')}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {actions && <div className="border-t border-border/60 px-5 py-4 sm:px-6">{actions}</div>}
    </section>
  )
}
