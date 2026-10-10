import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'

interface ReportSegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Overrides the visible label as the accessible name, e.g. "Last 3 months" for "3M". */
  ariaLabel?: string
}

interface ReportSegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: readonly ReportSegmentedOption<T>[]
  /** Names the group, e.g. "Breakdown range". */
  label: string
  className?: string
}

/**
 * The range and mode switches on Insights: the segmented look of `Tabs variant="segmented"`, but
 * as a group of pressed-state toggles rather than a tablist, because each one re-draws the same
 * chart instead of switching between panels. Every option keeps the 44px floor below the expanded
 * tier and steps down beside the denser desktop charts.
 */
export function ReportSegmented<T extends string>({ value, onChange, options, label, className }: ReportSegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex min-w-0 items-center gap-0.5 rounded-full bg-surface-2 p-1', className)}
    >
      {options.map(option => {
        const active = option.value === value
        return (
          <Button
            key={option.value}
            variant="tertiary"
            size="sm"
            aria-pressed={active}
            aria-label={option.ariaLabel}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-w-11 flex-1 whitespace-nowrap rounded-full px-3 lg:min-h-7 lg:px-2.5',
              active
                ? 'bg-card text-foreground shadow-xs ring-1 ring-border/60 hover:bg-card dark:bg-surface-3 dark:ring-transparent dark:hover:bg-surface-3'
                : 'text-muted-foreground hover:bg-transparent hover:text-foreground',
            )}
          >
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}
