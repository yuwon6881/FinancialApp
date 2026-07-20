import React from 'react'
import { Calendar, Eye, EyeOff, Wallet } from 'lucide-react'
import { CustomSelect } from '../ui/CustomSelect'
import { AnimatedNumber } from '../ui/AnimatedNumber'
import { SENSITIVE_AMOUNT_MASK } from '../../lib/utils'
import { getCycleLabelForDropdown, ordinal } from '../../lib/cycleLabels'

interface DashboardHeaderProps {
  cycleLabel: string
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  months: string[]
  years: number[]
  walletBalance: number
  areBalanceAmountsMasked: boolean
  hideSensitive: boolean
  hideBalanceAmounts: boolean
  formatCurrency: (val: number) => string
  onToggleBalanceAmounts: () => void
  onSelectPeriod: (month: string, year: number) => void
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  cycleLabel,
  selectedMonth,
  selectedYear,
  cycleDay,
  months,
  years,
  walletBalance,
  areBalanceAmountsMasked,
  hideSensitive,
  hideBalanceAmounts,
  formatCurrency,
  onToggleBalanceAmounts,
  onSelectPeriod,
}) => {
  return (
    <div className="app-panel relative z-40 overflow-visible rounded-2xl border border-blue-500/15 bg-card/90">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-4 sm:p-6 rounded-2xl bg-linear-to-br from-blue-500/10 via-transparent to-teal-500/10">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/15">
            <Wallet className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Ledger Dashboard
            </h2>
            <p className="text-muted-foreground text-xs mt-0.5 truncate">
              Active Cycle: <span className="font-semibold text-blue-500">{cycleLabel}</span>
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 lg:max-w-2xl">
          <div className="flex flex-col gap-3 rounded-xl border border-blue-500/15 bg-background/55 px-3.5 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-blue-500">Wallet Balance</span>
                <span className="rounded-md border border-border/50 bg-card/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  Essentials + Stability + Rewards
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Growth savings are excluded from this spendable balance.
              </p>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
              <div className="text-left sm:text-right">
                <div className="text-xl font-black text-foreground">
                  {areBalanceAmountsMasked ? (
                    <span className="font-mono tracking-wide">{SENSITIVE_AMOUNT_MASK}</span>
                  ) : (
                    <AnimatedNumber value={walletBalance} formatFn={formatCurrency} />
                  )}
                </div>
                <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                  {hideSensitive ? 'Sensitive mode active' : hideBalanceAmounts ? 'Hidden on this device' : 'Visible'}
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleBalanceAmounts}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card/80 text-muted-foreground transition hover:border-blue-500/35 hover:bg-blue-500/10 hover:text-blue-500 cursor-pointer"
                title={hideBalanceAmounts ? 'Show wallet and carryover balances' : 'Hide wallet and carryover balances'}
                aria-label={hideBalanceAmounts ? 'Show wallet and carryover balances' : 'Hide wallet and carryover balances'}
              >
                {hideBalanceAmounts ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Calendar className="size-3.5 text-teal-500" />
            <span>Cycle starts on the</span>
            <span className="font-bold text-foreground">{ordinal(cycleDay)}</span>
          </div>
        </div>
      </div>

      <div className="relative z-50 grid grid-cols-[minmax(0,1fr)_5.5rem] sm:grid-cols-[minmax(14rem,1fr)_7rem] gap-2 w-full lg:w-auto lg:min-w-[22rem]">
        {/* Month Selector */}
        <CustomSelect
          value={selectedMonth}
          onChange={(val) => onSelectPeriod(val, selectedYear)}
          options={months.map(m => ({
            value: m,
            label: getCycleLabelForDropdown(m, selectedYear, cycleDay)
          }))}
          className="w-full"
        />

        {/* Year Selector */}
        <CustomSelect
          value={selectedYear}
          onChange={(val) => onSelectPeriod(selectedMonth, Number(val))}
          options={years.map(y => ({
            value: y,
            label: y.toString()
          }))}
          className="w-full"
          align="right"
        />
      </div>
      </div>
    </div>
  )
}
