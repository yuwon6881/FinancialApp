import type { ReactNode } from 'react'
import { Button } from '../../ui/Button'
import { CategoryIcon } from '../../ui/CategoryIcon'
import { cn } from '../../../lib/utils'

export interface PickerOption {
  value: string
  label: string
  /** A short note under or beside the label, e.g. an AI suggestion's confidence. */
  badge?: string
  disabled?: boolean
  /** A colour swatch for the option (bucket identity colours). */
  swatch?: string
}

interface ChipPickerProps {
  label: string
  value: string | null
  options: PickerOption[]
  onChange: (value: string) => void
  className?: string
  leading?: (option: PickerOption) => ReactNode
}

/**
 * A short list of choices laid out as pills, all visible at once: the bucket a transaction comes
 * out of, the account it is paid from. A radio group underneath, so it reads as one choice.
 */
export function ChipPicker({ label, value, options, onChange, className, leading }: ChipPickerProps) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {options.map(option => {
        const selected = option.value === value
        return (
          <Button
            key={option.value}
            variant="tertiary"
            size="sm"
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'gap-2 border px-3.5',
              selected
                ? 'border-foreground/80 bg-card font-semibold text-foreground hover:bg-card'
                : 'border-border/70 font-medium text-muted-foreground hover:text-foreground',
            )}
          >
            {leading?.(option)}
            {option.swatch && (
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: option.swatch }} />
            )}
            <span className="truncate">{option.label}</span>
          </Button>
        )
      })}
    </div>
  )
}

interface CategoryTilesProps {
  value: string
  options: PickerOption[]
  onChange: (value: string) => void
}

/**
 * The categories most likely to be wanted, as icon tiles: AI suggestions first, then the rest in
 * the order they are kept in Settings. The full list stays one tap away in the select beneath.
 */
export function CategoryTiles({ value, options, onChange }: CategoryTilesProps) {
  if (options.length === 0) return null
  return (
    <div role="radiogroup" aria-label="Quick categories" className="grid grid-cols-4 gap-2">
      {options.map(option => {
        const selected = option.value === value
        return (
          <Button
            key={option.value}
            variant="tertiary"
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative h-auto min-h-0 min-w-0 flex-col gap-1.5 rounded-control border px-1 py-2.5 lg:min-h-0',
              selected
                ? 'border-foreground/80 bg-card hover:bg-card'
                : 'border-transparent bg-surface-2/70 hover:bg-surface-2 dark:bg-surface-3/70 dark:hover:bg-surface-3',
            )}
          >
            <CategoryIcon category={option.value} size="sm" />
            <span className={cn('w-full truncate text-center text-caption', selected ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>
              {option.label}
            </span>
            {option.badge && (
              <>
                <span aria-hidden="true" className="absolute right-1 top-1 rounded-full bg-primary/14 px-1.5 text-micro text-accent-ink">AI</span>
                <span className="sr-only">, {option.badge}</span>
              </>
            )}
          </Button>
        )
      })}
    </div>
  )
}
