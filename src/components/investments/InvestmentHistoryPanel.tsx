import { useMemo, useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import type { InvestmentHistorySegment, InvestmentHistoryYear, InvestmentInstrument } from '../../types'
import { buildSleeveIndex, sleeveLabelFor } from '../../lib/investmentAllocation'
import { formatSignedPercent, headlineReturn, monthLabel, yearBarScale, yearLabel } from '../../lib/investmentHistory'
import { cn, formatCurrencyVal } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { useInvestmentHistory } from './useInvestmentHistory'

const MASK = '••'
// Years shown before the rest fold away: a decade of rows would bury the market breakdown.
const RECENT_YEARS = 5
const tone = (value: number | undefined) => value === undefined
  ? 'text-muted-foreground'
  : value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'

/**
 * The long view: what was put in and what the market added, every calendar year and since the
 * start, overall and per market. Built from settled month-ends only, so a figure here never
 * moves once shown unless older activity is edited.
 */
export function InvestmentHistoryPanel({ instruments, masked, refreshToken }: {
  instruments: InvestmentInstrument[]
  masked: boolean
  refreshToken: number
}) {
  const { history, error, loading } = useInvestmentHistory(refreshToken)
  const [showAllYears, setShowAllYears] = useState(false)
  const sleeves = useMemo(() => buildSleeveIndex(instruments), [instruments])
  const currency = history?.currency ?? 'USD'
  const money = (value: number | undefined) =>
    masked ? MASK : value === undefined ? 'Unknown' : formatCurrencyVal(value, currency)
  const signedMoney = (value: number | undefined) =>
    masked || value === undefined || value <= 0 ? money(value) : `+${money(value)}`
  const percent = (value: number | undefined) =>
    masked ? MASK : value === undefined ? 'Unknown' : formatSignedPercent(value)
  const marketName = (segment: InvestmentHistorySegment) => sleeveLabelFor(segment.segment, sleeves)

  const years = history?.years ?? []
  const shownYears = showAllYears ? years : years.slice(0, RECENT_YEARS)
  const hiddenYears = years.length - shownYears.length
  const scale = yearBarScale(years)
  const headline = history ? headlineReturn(history) : null
  const asOf = history?.lifetime.asOf

  return (
    <Panel as="section" padding="spacious" aria-labelledby="investment-history-title">
      <h2 id="investment-history-title" className="text-section text-foreground">Year by year</h2>
      <p className="mt-1 text-caption text-muted-foreground">
        {asOf
          ? `Settled months up to the end of ${monthLabel(asOf)}; Portfolio shows today’s prices. Money you add is not counted as growth.`
          : 'Each month appears about a week after it ends, once its closing prices are final.'}
      </p>

      {!history && loading && (
        <div aria-hidden="true" className="mt-5 space-y-3">
          <div className="h-16 animate-pulse rounded-control bg-surface-2" />
          <div className="h-12 animate-pulse rounded-control bg-surface-2" />
        </div>
      )}
      {!history && !loading && error && (
        <p role="status" className="mt-4 rounded-control inset-group px-4 py-5 text-center text-label text-muted-foreground">{error}</p>
      )}
      {history && years.length === 0 && (
        <p className="mt-4 rounded-control inset-group px-4 py-5 text-center text-label text-muted-foreground">
          Your first year starts here once a full month of activity has settled.
        </p>
      )}

      {history && years.length > 0 && headline && (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-3 @3xl:grid-cols-4">
            <Stat label="Put in" value={money(history.lifetime.netContributions)} />
            <Stat label="Worth" value={money(history.lifetime.value)} />
            <Stat label="Growth" value={signedMoney(history.lifetime.growth)} valueClassName={masked ? undefined : tone(history.lifetime.growth)} />
            <Stat label={headline.label} value={percent(headline.value)} valueClassName={masked ? undefined : tone(headline.value)} />
          </dl>

          <div aria-hidden="true" className={cn('mt-5 flex flex-wrap gap-4 text-caption font-medium text-muted-foreground', masked && 'invisible')}>
            <span><i className="mr-1 inline-block h-1.5 w-3 rounded-full align-middle" style={{ backgroundColor: 'var(--ledger-pending-500)' }} />Added</span>
            <span><i className="mr-1 inline-block h-1.5 w-3 rounded-full bg-emerald-500 align-middle" />Market growth</span>
            <span><i className="mr-1 inline-block h-1.5 w-3 rounded-full bg-red-500 align-middle" />Market loss</span>
          </div>
          <ul className="mt-2 divide-y divide-border/60" aria-label="Each year">
            {shownYears.map(year => (
              <li key={year.year}>
                <YearRow year={year} firstMonth={history.lifetime.firstMonth} scale={scale} masked={masked} money={money} signedMoney={signedMoney} percent={percent} marketName={marketName} />
              </li>
            ))}
          </ul>
          {(hiddenYears > 0 || showAllYears) && years.length > RECENT_YEARS && (
            <div className="mt-1 flex justify-center">
              <Button variant="tertiary" size="sm" aria-expanded={showAllYears} onClick={() => setShowAllYears(value => !value)}>
                {showAllYears ? 'Show recent years only' : `Show ${hiddenYears} earlier ${hiddenYears === 1 ? 'year' : 'years'}`}
                <ChevronDown className={cn('size-4 transition-transform', showAllYears && 'rotate-180')} aria-hidden="true" />
              </Button>
            </div>
          )}

          {history.lifetime.segments.length > 1 && (
            <div className="mt-5">
              <h3 className="text-subsection text-foreground">By market, since the start</h3>
              <SegmentList segments={history.lifetime.segments} money={money} signedMoney={signedMoney} percent={percent} marketName={marketName} />
            </div>
          )}

          {!history.lifetime.isComplete && (
            <p className="mt-4 flex items-start gap-2 text-caption text-muted-foreground">
              <Info className="mt-px size-4 shrink-0" aria-hidden="true" />
              Some months are missing a price or exchange rate, so figures that depend on them show as unknown until the data arrives.
            </p>
          )}
        </>
      )}
    </Panel>
  )
}

function Stat({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="min-w-0 rounded-control inset-group px-3 py-2.5">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 truncate text-body font-semibold tabular-nums text-foreground', valueClassName)}>{value}</dd>
    </div>
  )
}

type Formatters = {
  money: (value: number | undefined) => string
  signedMoney: (value: number | undefined) => string
  percent: (value: number | undefined) => string
  marketName: (segment: InvestmentHistorySegment) => string
}

function YearRow({ year, firstMonth, scale, masked, money, signedMoney, percent, marketName }: Formatters & {
  year: InvestmentHistoryYear
  firstMonth?: string
  scale: number
  masked: boolean
}) {
  const added = Math.abs(year.netContributions ?? 0) / scale * 100
  const grown = year.growth === undefined ? 0 : Math.abs(year.growth) / scale * 100
  const label = yearLabel(year, firstMonth)
  return (
    <details className="group">
      <summary
        aria-label={`${label}: added ${money(year.netContributions)}, growth ${signedMoney(year.growth)}, return ${percent(year.returnPercent)}`}
        className="grid min-h-14 cursor-pointer select-none grid-cols-[minmax(0,1fr)_auto_1rem] items-center gap-x-3 gap-y-1.5 rounded-control px-1 py-3 outline-none transition-colors hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
      >
        <span className="min-w-0">
          <span className="block text-label font-semibold text-foreground">{label}</span>
          <span className="block text-caption text-muted-foreground">
            Added {money(year.netContributions)} · ended at {money(year.closingValue)}
          </span>
        </span>
        <span className="text-right">
          <span className={cn('block text-label font-semibold tabular-nums', masked ? 'text-foreground' : tone(year.returnPercent))}>{percent(year.returnPercent)}</span>
          <span className={cn('block text-caption tabular-nums', masked ? 'text-muted-foreground' : tone(year.growth))}>{signedMoney(year.growth)}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
        {/* What you added beside what the market did, on one scale across every year. */}
        <span aria-hidden="true" className={cn('col-span-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-foreground/8 dark:bg-foreground/10', masked && 'invisible')}>
          <span className="h-full rounded-full" style={{ width: `${added}%`, backgroundColor: 'var(--ledger-pending-500)' }} />
          {year.growth !== undefined && (
            <span className={cn('h-full rounded-full', year.growth >= 0 ? 'bg-emerald-500' : 'bg-red-500')} style={{ width: `${grown}%` }} />
          )}
        </span>
      </summary>
      <div className="space-y-3 px-1 pb-4">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-caption @md:grid-cols-2 @3xl:grid-cols-4">
          <Pair label="Started at" value={money(year.openingValue)} />
          <Pair label="Ended at" value={money(year.closingValue)} />
          <Pair label="Dividends" value={money(year.dividends)} />
          <Pair label="Gain or loss on sales"value={signedMoney(year.realisedProfitLoss)} />
        </dl>
        {year.segments.length > 0 && (
          <SegmentList segments={year.segments} money={money} signedMoney={signedMoney} percent={percent} marketName={marketName} />
        )}
        {year.missingReasons.length > 0 && (
          <ul className="space-y-1 text-caption text-muted-foreground" aria-label={`Why some ${year.year} figures are unknown`}>
            {year.missingReasons.map(reason => <li key={reason}>{reason}</li>)}
          </ul>
        )}
      </div>
    </details>
  )
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 justify-between gap-2 @3xl:block">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="shrink-0 font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  )
}

function SegmentList({ segments, money, signedMoney, percent, marketName }: Formatters & { segments: InvestmentHistorySegment[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {segments.map(segment => (
        <li key={segment.segment} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 rounded-control inset-group px-3 py-2">
          <span className="min-w-0">
            <span className="block truncate text-label font-medium text-foreground">{marketName(segment)}</span>
            <span className="block truncate text-caption text-muted-foreground">Put in {money(segment.netContributions)} · worth {money(segment.closingValue)}</span>
          </span>
          <span className="text-right">
            <span className="block text-label font-semibold tabular-nums text-foreground">{percent(segment.returnPercent)}</span>
            <span className="block text-caption tabular-nums text-muted-foreground">{signedMoney(segment.growth)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
