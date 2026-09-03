import { CalendarClock, RotateCcw } from 'lucide-react'
import { Button } from './Button'
import { CustomSelect } from './CustomSelect'
import { getCycleLabelForDropdown } from '../../lib/cycleLabels'
import { MONTH_NAMES } from '../../lib/cycle'
import { cn } from '../../lib/utils'
import { panelClass } from './panelStyles'

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
}

/**
 * The one cycle picker for every cycle-dependent page. The Ledger and Reports each carried their
 * own copy in their own header, so the same choice sat in two different places and Recurring --
 * which is just as cycle-dependent -- had none at all.
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
}: CycleSwitcherProps) {
  const isCurrentCycle = selectedMonth === currentCycleMonth && selectedYear === currentCycleYear
  const years = availableYears.length > 0 ? availableYears : [selectedYear]

  return (
    <div className={cn(panelClass, 'relative z-40 flex flex-col gap-2 p-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:p-3')}>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        <span className="flex shrink-0 items-center gap-1.5 pl-0.5 text-xs font-bold text-muted-foreground">
          <CalendarClock className="size-4 text-accent-ink" aria-hidden />
          <span className="hidden sm:inline">Cycle</span>
        </span>

        {periodMode === 'month-year' && (
          <CustomSelect
            ariaLabel={`${surfaceLabel} cycle`}
            value={selectedMonth}
            onChange={month => onSelectPeriod(String(month), selectedYear)}
            options={MONTH_NAMES.map(month => ({
              value: month,
              label: getCycleLabelForDropdown(month, selectedYear, cycleDay),
            }))}
            disabled={disabled}
            className="w-0 min-w-0 flex-1 sm:w-56 sm:flex-initial"
          />
        )}
        <CustomSelect
          ariaLabel={`${surfaceLabel} cycle year`}
          value={selectedYear}
          onChange={year => onSelectPeriod(selectedMonth, Number(year))}
          options={years.map(year => ({ value: year, label: String(year) }))}
          disabled={disabled}
          className={periodMode === 'month-year' ? 'w-28 shrink-0' : 'w-0 min-w-0 flex-1 sm:w-40 sm:flex-initial'}
          align="right"
        />
      </div>

      {!isCurrentCycle && (
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => onSelectPeriod(currentCycleMonth, currentCycleYear)}
          disabled={disabled}
          title={`Back to ${getCycleLabelForDropdown(currentCycleMonth, currentCycleYear, cycleDay)}`}
          className="min-h-10 w-full justify-center gap-1.5 rounded-xl px-3 text-xs sm:min-h-9 sm:w-auto sm:shrink-0"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          <span className="whitespace-nowrap">Back to current cycle</span>
        </Button>
      )}
    </div>
  )
}
