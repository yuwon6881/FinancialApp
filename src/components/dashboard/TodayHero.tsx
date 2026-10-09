import { CalendarClock, Check, Eye, EyeOff } from 'lucide-react'
import type { CycleProgress } from '../../lib/cycle'
import { cn } from '../../lib/utils'
import { AmountText } from '../ui/AmountText'
import { IconButton } from '../ui/IconButton'
import { ProgressRing } from '../ui/ProgressRing'
import { panelClass } from '../ui/panelStyles'

interface TodayHeroProps {
  walletBalance: number
  currency: string
  /** Sensitive mode or the device-only balance toggle: either hides the figure. */
  isMasked: boolean
  hideBalanceAmounts: boolean
  onToggleBalanceAmounts: () => void
  cycle: CycleProgress
}

const shortDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/**
 * The first thing Today says: how much money there is, and how far through the cycle it has to
 * last. The balance is the page's one jumbo figure and ticks to a new value instead of swapping;
 * the cycle sits beside it as a ring, so "how much" and "how long" are read together.
 */
export function TodayHero({
  walletBalance,
  currency,
  isMasked,
  hideBalanceAmounts,
  onToggleBalanceAmounts,
  cycle,
}: TodayHeroProps) {
  const toggleLabel = hideBalanceAmounts ? 'Show available balance' : 'Hide available balance'
  const ringPercent = cycle.phase === 'active' ? cycle.progressPct : cycle.phase === 'ended' ? 100 : 0
  const headline = cycle.phase === 'upcoming'
    ? `Starts in ${cycle.daysUntilStart} day${cycle.daysUntilStart === 1 ? '' : 's'}`
    : cycle.phase === 'ended'
      ? 'Cycle ended'
      : `Day ${cycle.dayNumber} of ${cycle.totalDays}`
  const caption = cycle.phase === 'active'
    ? <>{cycle.daysLeft} day{cycle.daysLeft === 1 ? '' : 's'} left<span className="hidden @sm:inline"> · next cycle starts {shortDate(cycle.nextStartDate)}</span></>
    : cycle.phase === 'upcoming'
      ? <>{cycle.totalDays}-day cycle<span className="hidden @sm:inline"> · next cycle starts {shortDate(cycle.nextStartDate)}</span></>
      : `Ended ${shortDate(cycle.endDate)}`

  return (
    <section aria-labelledby="today-hero-heading" className={cn(panelClass, 'relative isolate overflow-hidden p-5 sm:p-7')}>
      {/* The page's one light source: a soft brand glow behind the balance. Decorative only. */}
      <div aria-hidden="true" className="today-hero-glow pointer-events-none absolute -z-10" />
      <div className="flex flex-col gap-6 @xl:flex-row @xl:items-end @xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <h2 id="today-hero-heading" className="text-label text-muted-foreground">Available now</h2>
            <IconButton
              variant="tertiary"
              type="button"
              onClick={onToggleBalanceAmounts}
              className="-my-2 text-muted-foreground hover:text-foreground"
              tooltip={toggleLabel}
              label={toggleLabel}
            >
              {hideBalanceAmounts ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </IconButton>
          </div>
          <div data-testid="available-now" className="mt-1 min-w-0">
            <AmountText
              animate
              value={walletBalance}
              currency={currency}
              isMasked={isMasked}
              className="text-display text-foreground @xs:text-hero @3xl:text-jumbo"
            />
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-4 border-t border-border/60 pt-5 @xl:border-t-0 @xl:border-l @xl:pl-7 @xl:pt-0">
          <ProgressRing
            percent={ringPercent}
            size={64}
            thickness={6}
            label={`Cycle progress: ${headline}`}
          >
            {cycle.phase === 'active'
              ? <span className="text-subsection tabular-nums text-foreground">{cycle.dayNumber}</span>
              : cycle.phase === 'ended'
                ? <Check className="size-5 text-muted-foreground" aria-hidden="true" />
                : <CalendarClock className="size-5 text-muted-foreground" aria-hidden="true" />}
          </ProgressRing>
          <div className="min-w-0">
            <p className="text-label text-muted-foreground">Cycle progress</p>
            <p className="mt-0.5 text-subsection text-foreground tabular-nums">{headline}</p>
            <p className="mt-0.5 text-caption text-muted-foreground">{caption}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
