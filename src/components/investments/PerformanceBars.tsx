import { useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import type { InvestmentPortfolio } from '../../types'
import { formatCurrencyVal } from '../../lib/utils'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { Panel } from '../ui/Panel'
import { ChevronRight } from 'lucide-react'
import { TickerTile } from './HoldingsList'

type RankMode = 'money' | 'percent'

const rankOptions: Array<{ value: RankMode; label: string }> = [
  { value: 'money', label: 'How much you gained' },
  { value: 'percent', label: 'How fast it grew' },
]

/**
 * Ranks holdings two ways because they answer different questions. Percentage
 * alone puts a 40% gain on a tiny position above a 9% gain on a large one, which
 * misdirects attention to the fund that moved the least actual money.
 */
export function PerformanceBars({ portfolio, masked, onSelectHolding }: {
  portfolio: InvestmentPortfolio
  masked: boolean
  onSelectHolding: (holding: InvestmentPortfolio['holdings'][number]) => void
}) {
  const reduceMotion = useReducedMotion()
  const [mode, setMode] = useState<RankMode>('money')
  const valueOf = (holding: InvestmentPortfolio['holdings'][number]) =>
    mode === 'money' ? holding.unrealisedProfitLossApp : holding.unrealisedPercent

  const holdings = portfolio.holdings
    .filter(holding => valueOf(holding) !== undefined)
    .sort((left, right) => (valueOf(right) ?? 0) - (valueOf(left) ?? 0))
  const scale = Math.max(...holdings.map(holding => Math.abs(valueOf(holding) ?? 0)), 1)
  const label = (holding: InvestmentPortfolio['holdings'][number]) => {
    const value = valueOf(holding) ?? 0
    if (masked) return '••'
    return mode === 'money'
      ? formatCurrencyVal(value, portfolio.appCurrency)
      : `${value.toFixed(1)}%`
  }

  return (
    <Panel as="section" padding="spacious" aria-labelledby="performance-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="performance-title" className="text-section text-foreground">How each fund is doing</h2>
        </div>
        <div className="w-full shrink-0 sm:w-auto">
          <CustomSelect
            value={mode}
            onChange={value => setMode(value as RankMode)}
            options={rankOptions}
            ariaLabel="Rank funds by"
            className="w-full sm:w-auto"
            align="right"
          />
        </div>
      </div>
      {/* Each fund is one row-wide target that opens its detail sheet: a ticker tile, the fund's
          name, a chevron, and a hover fill say so. A bare ticker in a text button did not. */}
      <ul className="-mx-2 mt-3 space-y-0.5">
        {holdings.map(holding => {
          const value = valueOf(holding) ?? 0
          const positive = value >= 0
          const ratio = Math.abs(value) / scale
          return (
            <li key={`${holding.accountId}-${holding.instrumentId}`}>
              <Button
                variant="tertiary"
                onClick={() => onSelectHolding(holding)}
                aria-label={`${holding.symbol} · ${holding.name}`}
                className="group grid h-auto w-full grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto_1rem] items-center justify-normal gap-3 rounded-control px-2 py-2 text-left font-normal hover:bg-surface-2 lg:min-h-12"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <TickerTile symbol={holding.symbol} className="size-9" />
                  <span className="min-w-0">
                    <span className="block truncate text-label font-semibold text-foreground">{holding.symbol}</span>
                    <span className="block truncate text-caption text-muted-foreground" title={holding.name}>{holding.name}</span>
                  </span>
                </span>
                <span className="relative h-2 rounded-full bg-foreground/8 dark:bg-foreground/10">
                  <span className="absolute left-1/2 top-0 h-full w-px bg-border" />
                  <m.span
                    className={`absolute top-0 block h-full w-1/2 rounded-full ${positive ? 'origin-left bg-emerald-500' : 'right-1/2 origin-right bg-red-500'}`}
                    initial={reduceMotion ? false : { scaleX: 0 }}
                    animate={{ scaleX: ratio }}
                    transition={{ duration: 0.55, ease: 'easeOut' }}
                    style={positive ? { left: '50%' } : undefined}
                  />
                </span>
                <span className={`min-w-13 text-right text-label font-semibold tabular-nums ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{label(holding)}</span>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden="true" />
              </Button>
            </li>
          )
        })}
      </ul>
      {holdings.length === 0 && (
        <p className="mt-4 rounded-control bg-inset px-4 py-6 text-center text-label text-muted-foreground">
          Needs latest prices and your cost.
        </p>
      )}
    </Panel>
  )
}
