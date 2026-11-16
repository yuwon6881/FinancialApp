import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { InvestmentCurrencySummary, InvestmentPortfolio } from '../../types'
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
 * move as one quiet line under it, a line per foreign currency in its own terms, and three facts in
 * an aligned strip. Each figure appears once: the breakdown below holds only what the hero does not
 * -- money in, and what has already been earned -- always open where there is room, one tap away on
 * a phone.
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

  const groups: Array<{ label: string; hint: string; rows: SummaryMetric[] }> = [
    {
      label: 'Money in',
      hint: 'What your budget set aside for investing, and how much of it has reached your broker.',
      rows: [
        {
          label: 'Set aside to invest',
          value: format(earmarked),
          hint: 'Total your budget has earmarked for investing so far.',
        },
        { label: 'Sent to broker', value: format(sentToBroker), hint: 'Deposits into your broker accounts, less withdrawals. Exchanging currency inside the broker sends nothing.', color: sentToBroker === undefined ? 'text-muted-foreground' : undefined },
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
      ],
    },
    {
      label: 'Earned so far',
      hint: 'What your investments have already paid you or locked in, and their average yearly return.',
      rows: [
        { label: 'Already banked', value: signed(realised), hint: 'Profit or loss locked in on investments you have sold, after fees and taxes.', color: tone(realised) },
        { label: 'Dividends received', value: format(portfolio.summary.netDividends), hint: 'Payouts your investments have paid you, after any tax withheld.' },
        {
          label: 'Yearly return',
          value: annualReturn === undefined ? 'Not available yet' : masked ? '••••' : `${annualReturn > 0 ? '+' : ''}${(annualReturn * 100).toFixed(1)}% a year`,
          hint: 'Average yearly return, adjusted for when each deposit went in.',
          color: tone(annualReturn),
        },
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
          <InfoHint label="What it is worth" text={`Latest saved value of your investments and broker cash in ${currency}. Anything held in another currency is converted at today’s rate, so gains show what the markets did, never the exchange rate; its line below shows it in that currency itself. The latest move is between your funds’ two latest saved prices, which may be from an earlier market day.`} />
        </div>
        <div data-testid="investment-total" className="mt-1 min-w-0">
          {totalValue === undefined
            ? <p className="text-title text-muted-foreground">Not available yet</p>
            : <AmountText animate value={totalValue} currency={currency} isMasked={masked} className="text-display text-foreground @xs:text-hero" />}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-label text-muted-foreground">
          {/* Only known figures: an unknown one would read as a claim. */}
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
          {totalValue === undefined && <span>Waiting on prices or today’s exchange rate</span>}
        </p>
        <ForeignCurrencies currencies={portfolio.summary.currencies ?? []} appCurrency={currency} masked={masked} tone={tone} />

        <dl className="mt-5 grid grid-cols-1 divide-y divide-foreground/10 rounded-control inset-group px-3.5 @md:grid-cols-3 @md:divide-x @md:divide-y-0 @md:px-0 @md:py-3">
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
        className="flex w-full justify-between rounded-none border-x-0 border-b-0 border-t border-t-border/60 px-5 text-muted-foreground hover:bg-surface-2/60 hover:text-foreground active:scale-100 active:bg-surface-3 transition-colors duration-120 ease-fluid sm:px-6 lg:hidden"
      >
        <span>{breakdownOpen ? 'Hide breakdown' : 'Show breakdown'}</span>
        <ChevronDown className={cn('size-4 transition-transform duration-200', breakdownOpen && 'rotate-180')} aria-hidden="true" />
      </Button>
      <div
        id={breakdownId}
        className={cn(
          'gap-x-10 gap-y-5 border-t border-border/60 px-5 py-4 sm:px-6 lg:grid lg:grid-cols-2 lg:py-5',
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

/**
 * One line per currency held besides the app currency, in that currency's own terms and never
 * converted: how that market has treated you, with today's rate that turns it into the total above.
 */
function ForeignCurrencies({ currencies, appCurrency, masked, tone }: {
  currencies: InvestmentCurrencySummary[]
  appCurrency: string
  masked: boolean
  tone: (value?: number) => string
}) {
  const home = appCurrency.toUpperCase()
  const foreign = currencies.filter(value => value.currency.toUpperCase() !== home)
  if (foreign.length === 0) return null
  const rateFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 })
  return (
    <ul aria-label="Each currency" className="mt-1.5 space-y-1 text-label text-muted-foreground">
      {foreign.map(item => {
        const gain = item.unrealisedProfitLoss
        const percent = item.unrealisedPercent
        return (
          <li key={item.currency} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span>
              In {item.currency}{' '}
              <span className="font-semibold tabular-nums text-foreground">
                {item.totalValue === undefined ? 'no price yet' : masked ? '••••' : money(item.totalValue, item.currency)}
              </span>
            </span>
            {gain !== undefined && (
              <span>
                <span className={cn('font-semibold tabular-nums', masked ? 'text-foreground' : tone(gain))}>
                  {masked ? '••••' : `${gain > 0 ? '+' : ''}${money(gain, item.currency)}${percent === undefined ? '' : ` · ${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`}`}
                </span> on paper
              </span>
            )}
            <span>
              {item.rateToAppCurrency === undefined
                ? `No ${item.currency}/${home} rate today`
                : `1 ${item.currency} = ${rateFormat.format(item.rateToAppCurrency)} ${home} today`}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
