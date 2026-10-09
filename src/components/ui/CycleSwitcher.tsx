import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { Button } from './Button'
import { IconButton } from './IconButton'
import { CustomSelect } from './CustomSelect'
import { getCycleLabelForDropdown } from '../../lib/cycleLabels'
import { MONTH_NAMES } from '../../lib/cycle'
import { cn } from '../../lib/utils'

export interface CycleSwitcherProps {
  selectedMonth: string
  selectedYear: number
  availableYears: number[]
  cycleDay: number
  onSelectPeriod: (month: string, year: number) => void
  /** The cycle today falls in, so the switcher can offer the way back to it. */
  currentCycleMonth: string
  currentCycleYear: number
  /** 'year' is for a scope pinned to a whole year, where a single cycle means nothing. */
  periodMode?: 'month-year' | 'year'
  /** Names the surface these cycles belong to, for the selects' accessible names. */
  surfaceLabel: string
  disabled?: boolean
  /**
   * Why the picker cannot be used right now. Shown in place of the "back to current cycle" action,
   * so a scope that spans every cycle disables the picker rather than unmounting it -- removing it
   * moved the whole page up by the switcher's height on every toggle.
   */
  unavailableReason?: string
  className?: string
}

/**
 * The one cycle picker for every cycle-dependent page: a compact pill with step arrows either side
 * of the cycle and year, so moving one cycle back is a single tap and jumping further is a pick.
 */
export function CycleSwitcher({
  selectedMonth,
  selectedYear,
  availableYears,
  cycleDay,
  onSelectPeriod,
  currentCycleMonth,
  currentCycleYear,
  periodMode = 'month-year',
  surfaceLabel,
  disabled = false,
  unavailableReason,
  className,
}: CycleSwitcherProps) {
  const isDisabled = disabled || Boolean(unavailableReason)
  const isCurrentCycle = selectedMonth === currentCycleMonth && selectedYear === currentCycleYear
  const years = availableYears.length > 0 ? availableYears : [selectedYear]
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years, currentCycleYear)

  const step = (direction: -1 | 1) => {
    if (periodMode === 'year') {
      const nextYear = selectedYear + direction
      if (nextYear >= minYear && nextYear <= maxYear) onSelectPeriod(selectedMonth, nextYear)
      return
    }
    const index = MONTH_NAMES.indexOf(selectedMonth) + direction
    const nextYear = selectedYear + (index < 0 ? -1 : index > 11 ? 1 : 0)
    const nextMonth = MONTH_NAMES[(index + 12) % 12]
    if (nextYear >= minYear && nextYear <= maxYear) onSelectPeriod(nextMonth, nextYear)
  }
  const atStart = periodMode === 'year'
    ? selectedYear <= minYear
    : selectedYear <= minYear && selectedMonth === MONTH_NAMES[0]
  const atEnd = periodMode === 'year'
    ? selectedYear >= maxYear
    : selectedYear >= maxYear && selectedMonth === MONTH_NAMES[11]

  return (
    <div className={cn('relative z-40 flex min-w-0 flex-wrap items-center gap-2', className)}>
      <div className="flex min-w-0 max-w-full items-center gap-0.5 rounded-full border border-border/70 bg-card p-1 shadow-xs dark:shadow-none">
        <IconButton
          label={periodMode === 'year' ? 'Previous year' : 'Previous cycle'}
          onClick={() => step(-1)}
          disabled={isDisabled || atStart}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronLeft className="size-4" />
        </IconButton>
        {periodMode === 'month-year' && (
          <CustomSelect
            variant="ghost"
            ariaLabel={`${surfaceLabel} cycle`}
            value={selectedMonth}
            onChange={month => onSelectPeriod(String(month), selectedYear)}
            options={MONTH_NAMES.map(month => ({
              value: month,
              label: getCycleLabelForDropdown(month, selectedYear, cycleDay),
            }))}
            disabled={isDisabled}
            className="w-0 min-w-0 flex-1 sm:w-48 sm:flex-initial"
          />
        )}
        <CustomSelect
          variant="ghost"
          ariaLabel={`${surfaceLabel} cycle year`}
          value={selectedYear}
          onChange={year => onSelectPeriod(selectedMonth, Number(year))}
          options={years.map(year => ({ value: year, label: String(year) }))}
          disabled={isDisabled}
          className={periodMode === 'month-year' ? 'w-24 shrink-0' : 'w-28 shrink-0'}
          align="right"
        />
        <IconButton
          label={periodMode === 'year' ? 'Next year' : 'Next cycle'}
          onClick={() => step(1)}
          disabled={isDisabled || atEnd}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronRight className="size-4" />
        </IconButton>
      </div>

      {unavailableReason ? (
        <p className="min-w-0 text-caption text-muted-foreground">{unavailableReason}</p>
      ) : !isCurrentCycle && (
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => onSelectPeriod(currentCycleMonth, currentCycleYear)}
          disabled={isDisabled}
          aria-label="Back to current cycle"
          title={`Back to ${getCycleLabelForDropdown(currentCycleMonth, currentCycleYear, cycleDay)}`}
          className="shrink-0"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          <span className="whitespace-nowrap">Current cycle</span>
        </Button>
      )}
    </div>
  )
}
