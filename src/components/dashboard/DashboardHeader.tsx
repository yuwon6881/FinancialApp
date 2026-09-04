import React from 'react'
import { CalendarCheck2, Eye, EyeOff, Wallet } from 'lucide-react'
import { SensitiveAmount } from '../ui/SensitiveAmount'
import { ordinal } from '../../lib/cycleLabels'
import { IconButton } from '../ui/IconButton'
import { Badge } from '../ui/Badge'
import { PageHeader } from '../ui/PageHeader'

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
  <PageHeader
    className="overflow-hidden border-blue-500/15 bg-linear-to-br from-blue-500/10 via-card/90 to-teal-500/10"
    title="Today"
    icon={<span className="flex size-10 items-center justify-center rounded-xl border border-blue-500/15 bg-blue-500/10 text-blue-500"><CalendarCheck2 className="size-5" /></span>}
    titleActions={<Badge tone="success"><CalendarCheck2 className="mr-1 size-3" />Starts on the {ordinal(cycleDay)}</Badge>}
    description={<>Current cycle · <span className="font-semibold text-blue-500">{cycleLabel}</span></>}
  >
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,25rem)] lg:items-center">
      <div aria-hidden="true" />
      <div className="min-w-0 w-full rounded-2xl border border-blue-500/15 bg-background/65 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Wallet className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-eyebrow uppercase text-blue-500">Available now</p>
              <p className="truncate text-xs text-muted-foreground">Excludes long-term Growth savings</p>
            </div>
          </div>
          <IconButton variant="secondary"
            type="button"
            onClick={onToggleBalanceAmounts}
            className="shrink-0 text-muted-foreground hover:text-blue-500"
            tooltip={hideBalanceAmounts ? 'Show available balance' : 'Hide available balance'}
            label={hideBalanceAmounts ? 'Show available balance' : 'Hide available balance'}
          >
            {hideBalanceAmounts ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </IconButton>
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1 border-t border-border/40 pt-3">
          <div className="min-w-0 truncate text-2xl sm:text-3xl font-black tracking-tight text-foreground tabular-nums">
            <SensitiveAmount value={walletBalance} isMasked={areBalanceAmountsMasked} formatFn={formatCurrency} />
          </div>
          <p className="shrink-0 pb-0.5 text-right text-xs font-medium text-muted-foreground">
            {hideSensitive ? 'Sensitive mode active' : hideBalanceAmounts ? 'Hidden on this device' : 'Visible on this device'}
          </p>
        </div>
      </div>
    </div>
  </PageHeader>
)
