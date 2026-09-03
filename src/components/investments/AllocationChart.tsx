import { useMemo, useState } from 'react'
import type { InvestmentPortfolio } from '../../types'
import { buildSleeveIndex, sleeveOf } from '../../lib/investmentAllocation'
import { filterHoldings, type AllocationFilter, type AllocationMode } from '../../lib/investmentHoldingFilter'
import { formatCurrencyVal } from '../../lib/utils'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { InteractiveDoughnutChart } from '../ui/InteractiveDoughnutChart'

const money = (value: number, currency: string) => formatCurrencyVal(value, currency)

export function AllocationChart({ portfolio, masked, selected, onSelect }: {
  portfolio: InvestmentPortfolio
  masked: boolean
  selected: AllocationFilter
  onSelect: (value: AllocationFilter) => void
}) {
  const [mode, setMode] = useState<AllocationMode>('sleeve')
  const sleeveIndex = useMemo(() => buildSleeveIndex(portfolio.instruments), [portfolio.instruments])
  // Each group carries the string a person reads (`label`) and the one the holdings
  // filter matches on (`filterKey`) — for funds those differ, so keep them apart
  // rather than parsing the label back apart later.
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; filterKey: string; value: number }>()
    const add = (label: string, filterKey: string, value: number) => {
      const existing = map.get(label)
      map.set(label, { label, filterKey, value: (existing?.value ?? 0) + value })
    }
    portfolio.holdings.forEach(holding => {
      const sleeve = sleeveOf(holding, sleeveIndex)
      const [label, filterKey] = mode === 'sleeve'
        ? [sleeve.label, sleeve.key]
        : mode === 'asset' ? [holding.type, holding.type]
          : mode === 'account' ? [holding.accountName, holding.accountName]
            : mode === 'currency' ? [holding.currency, holding.currency]
            : [`${holding.symbol} · ${holding.name}`, holding.symbol]
      add(label, filterKey, holding.valueApp ?? 0)
    })
    portfolio.cashBalances.forEach(balance => {
      if (balance.amountApp === undefined || balance.amountApp <= 0) return
      const label = mode === 'account' ? balance.accountName : mode === 'currency' ? balance.currency : 'Cash'
      add(label, label, balance.amountApp)
    })
    return [...map.values()].sort((a, b) => b.value - a.value)
  }, [portfolio.holdings, portfolio.cashBalances, mode, sleeveIndex])
  const total = groups.reduce((sum, group) => sum + group.value, 0)
  const colors = [
    'var(--ledger-purple-500)',
    'var(--ledger-sky-500)',
    'var(--ledger-pending-500)',
    'var(--ledger-expense-500)',
    'var(--ledger-income-500)',
    'var(--ledger-blue-500)',
    'var(--ledger-wishlist-500)',
    'var(--ledger-neutral-500)',
  ]
  const slices = groups.map((group, index) => ({
    key: group.label,
    label: group.label,
    value: group.value,
    color: colors[index % colors.length],
  }))
  const allocationModeOptions: Array<{ value: AllocationMode; label: string }> = [
    { value: 'sleeve', label: 'Basket in your plan' },
    { value: 'instrument', label: 'Individual fund' },
    { value: 'asset', label: 'Kind of investment' },
    { value: 'account', label: 'Account' },
    { value: 'currency', label: 'Currency' },
  ]
  const selectedLabel = selected?.mode === mode
    ? groups.find(group => group.filterKey === selected.key)?.label
    : undefined
  const selectedHoldings = selectedLabel === undefined
    ? []
    : filterHoldings(portfolio.holdings, selected, sleeveIndex)
        .sort((left, right) => (right.valueApp ?? 0) - (left.valueApp ?? 0))
  const selectSlice = (label: string) => {
    if (label === 'Cash' && mode !== 'account') {
      onSelect(null)
      return
    }
    const filterKey = groups.find(group => group.label === label)?.filterKey ?? label
    onSelect(selected?.mode === mode && selected.key === filterKey ? null : { mode, key: filterKey })
  }

  return (
    <section aria-labelledby="allocation-title" className="app-panel min-w-0 flex flex-col rounded-2xl border border-border/60 bg-card/92 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><h2 id="allocation-title" className="text-base font-bold text-foreground">Where your money sits</h2><p className="mt-1 text-xs text-muted-foreground">See holdings and cash by basket; select a slice to filter below.</p></div>
        <div className="w-full shrink-0 sm:w-auto">
          <CustomSelect
            value={mode}
            onChange={value => { setMode(value as AllocationMode); onSelect(null) }}
            options={allocationModeOptions}
            ariaLabel="Group by"
            className="w-full sm:w-auto"
            align="right"
          />
        </div>
      </div>
      <div className="mt-5 flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden sm:flex-row 2xl:flex-col 2xl:justify-start">
        {groups.length > 0 ? (
          <InteractiveDoughnutChart
            key={mode}
            slices={slices}
            ariaLabel={groups.map(group => `${group.label} ${total ? (group.value / total * 100).toFixed(1) : 0}%`).join(', ')}
            centerLabel="Total"
            centerValue={money(total, portfolio.appCurrency)}
            formatValue={value => money(value, portfolio.appCurrency)}
            masked={masked}
            selectedKey={selectedLabel}
            onActivate={slice => selectSlice(slice.label)}
            chartClassName="mx-auto aspect-square w-full max-w-52 sm:mx-0 sm:w-48 2xl:mx-auto 2xl:w-56 2xl:max-w-56"
            // Scrolls rather than clips. "Individual fund" mode lists one row per holding, and
            // under overflow-hidden the rows past the panel's height were unreachable, so the
            // shared arc-hover reveal had nowhere to scroll either. Matches the outflow legend's
            // bounded, scrollbar-less box.
            legendClassName="w-full min-w-0 flex-1 max-h-56 space-y-1 overflow-y-auto no-scrollbar 2xl:max-h-64 2xl:flex-none"
          />
        ) : <p className="text-xs text-muted-foreground">Add prices to see what you hold.</p>}
      </div>
      {/* The slice's contents are listed here rather than only filtering the table
          further down the page: that table is off-screen on a phone, so a click
          previously looked like it had done nothing at all. */}
      {selectedLabel && (
        <div className="mt-4 rounded-xl border border-border/50 bg-muted/20 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="min-w-0 truncate text-xs font-bold text-foreground">Inside {selectedLabel}</h3>
            <Button
              variant="tertiary"
              type="button"
              onClick={() => onSelect(null)}
              className="shrink-0 cursor-pointer text-xs font-bold text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
            >
              Show everything
            </Button>
          </div>
          {selectedHoldings.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              This slice is cash rather than funds, so there is nothing to list.
            </p>
          ) : (
            <>
              <ul className="mt-2 space-y-1.5">
                {selectedHoldings.map(holding => (
                  <li key={`${holding.accountId}-${holding.instrumentId}`} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate">
                      <b className="text-foreground">{holding.symbol}</b>
                      <span className="text-muted-foreground"> · {holding.accountName}</span>
                    </span>
                    <span className="shrink-0 font-bold text-foreground">
                      {masked ? '••••' : holding.valueApp === undefined ? 'Unavailable' : money(holding.valueApp, portfolio.appCurrency)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                The holdings table below is showing only these.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}
