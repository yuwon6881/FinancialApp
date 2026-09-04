import { useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import type { InvestmentPortfolio } from '../../types'
import { formatCurrencyVal } from '../../lib/utils'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { Panel } from '../ui/Panel'

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
    <Panel as="section" aria-labelledby="performance-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="performance-title" className="text-section text-foreground">How each fund is doing</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === 'money'
              ? 'Gain or loss on paper, in money. Pick a fund to see its history.'
              : 'Gain or loss on paper, as a percentage of what you paid.'}
          </p>
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
      <div className="mt-4 space-y-3">
        {holdings.map(holding => {
          const value = valueOf(holding) ?? 0
          const positive = value >= 0
          const ratio = Math.abs(value) / scale
          return (
            <div key={`${holding.accountId}-${holding.instrumentId}`} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 text-xs">
              <Button
                variant="tertiary"
                onClick={() => onSelectHolding(holding)}
                className="min-w-0 cursor-pointer truncate text-left font-bold text-foreground underline decoration-dotted underline-offset-4 hover:text-accent-ink"
              >
                {holding.symbol}
              </Button>
              <div className="relative h-3 rounded-full bg-muted">
                <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                <m.div
                  className={`absolute top-0 h-full w-1/2 rounded-full ${positive ? 'origin-left bg-emerald-500' : 'right-1/2 origin-right bg-orange-500'}`}
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  animate={{ scaleX: ratio }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                  style={positive ? { left: '50%' } : undefined}
                />
              </div>
              <span className={`min-w-13 text-right font-bold ${positive ? 'text-emerald-500' : 'text-orange-500'}`}>{label(holding)}</span>
            </div>
          )
        })}
        {holdings.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Latest prices and what you paid are both needed before this can be worked out.
          </p>
        )}
      </div>
    </Panel>
  )
}
