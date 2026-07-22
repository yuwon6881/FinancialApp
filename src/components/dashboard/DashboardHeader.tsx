import React from 'react'
import { CalendarCheck2, Eye, EyeOff, Wallet } from 'lucide-react'
import { SensitiveAmount } from '../ui/SensitiveAmount'
import { ordinal } from '../../lib/cycleLabels'

interface DashboardHeaderProps {
  cycleLabel: string
  cycleDay: number
  walletBalance: number
  areBalanceAmountsMasked: boolean
  hideSensitive: boolean
  hideBalanceAmounts: boolean
  formatCurrency: (val: number) => string
  onToggleBalanceAmounts: () => void
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  cycleLabel,
  cycleDay,
  walletBalance,
  areBalanceAmountsMasked,
  hideSensitive,
  hideBalanceAmounts,
  formatCurrency,
  onToggleBalanceAmounts,
}) => (
  <header className="app-panel overflow-hidden rounded-2xl border border-blue-500/15 bg-card/90">
    <div className="grid gap-5 rounded-2xl bg-linear-to-br from-blue-500/10 via-transparent to-teal-500/10 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,25rem)] lg:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/15 bg-blue-500/10 text-blue-500">
            <CalendarCheck2 className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Today</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Your current salary cycle · <span className="font-semibold text-blue-500">{cycleLabel}</span>
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <CalendarCheck2 className="size-3.5 text-teal-500" />
          <span>Cycle starts on the</span>
          <span className="font-bold text-foreground">{ordinal(cycleDay)}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-500/15 bg-background/65 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Wallet className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500">Available now</p>
              <p className="truncate text-[10px] text-muted-foreground">Excludes long-term Growth savings</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleBalanceAmounts}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card/80 text-muted-foreground transition hover:border-blue-500/35 hover:bg-blue-500/10 hover:text-blue-500 cursor-pointer"
            title={hideBalanceAmounts ? 'Show available balance' : 'Hide available balance'}
            aria-label={hideBalanceAmounts ? 'Show available balance' : 'Hide available balance'}
          >
            {hideBalanceAmounts ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-border/40 pt-3">
          <div className="text-2xl font-black text-foreground">
            <SensitiveAmount value={walletBalance} isMasked={areBalanceAmountsMasked} formatFn={formatCurrency} />
          </div>
          <p className="pb-0.5 text-right text-[10px] font-semibold text-muted-foreground">
            {hideSensitive ? 'Sensitive mode active' : hideBalanceAmounts ? 'Hidden on this device' : 'Visible on this device'}
          </p>
        </div>
      </div>
    </div>
  </header>
)
