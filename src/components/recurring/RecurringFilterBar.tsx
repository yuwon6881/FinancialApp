import React from 'react'
import { getCategoryDotClass } from '../../lib/categoryColors'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { Toolbar } from '../ui/Toolbar'

const BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const

interface RecurringFilterBarProps {
  selectedCategories: string[]
  sortOrder: string
  onToggleCategoryFilter: (cat: string) => void
  onClearFilters: () => void
  onSortChange: (value: string) => void
  allLabel?: string
  filterAriaLabel?: string
  sortAriaLabel?: string
  sortOptions?: Array<{ value: string; label: string }>
}

/**
 * Filter and sort as one row: the four buckets are chips you toggle in place (any mix of them, or
 * All), with the sort order beside them. Four choices never needed a popover to hide them in.
 */
export const RecurringFilterBar: React.FC<RecurringFilterBarProps> = ({
  selectedCategories,
  sortOrder,
  onToggleCategoryFilter,
  onClearFilters,
  onSortChange,
  allLabel = 'All',
  filterAriaLabel = 'Filter recurring payment categories',
  sortAriaLabel = 'Sort recurring payments',
  sortOptions = [
    { value: 'amount-desc', label: 'Amount, high to low' },
    { value: 'amount-asc', label: 'Amount, low to high' },
    { value: 'name-asc', label: 'Name, A to Z' },
    { value: 'due-date', label: 'Due day of the month' },
  ],
}) => {
  const chipClass = (selected: boolean) => cn(
    'shrink-0 gap-2 border px-3.5',
    selected
      ? 'border-foreground/80 bg-card font-semibold text-foreground hover:bg-card'
      : 'border-border/70 font-medium text-muted-foreground hover:text-foreground',
  )

  return (
    <Toolbar aria-label="Recurring filters" className="flex-nowrap items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
      <div role="group" aria-label={filterAriaLabel} className="no-scrollbar -mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 py-0.5">
        <Button
          variant="tertiary"
          size="sm"
          aria-pressed={selectedCategories.length === 0}
          onClick={onClearFilters}
          className={chipClass(selectedCategories.length === 0)}
        >
          {allLabel}
        </Button>
        {BUCKETS.map(bucket => {
          const selected = selectedCategories.includes(bucket)
          return (
            <Button
              key={bucket}
              variant="tertiary"
              size="sm"
              aria-pressed={selected}
              onClick={() => onToggleCategoryFilter(bucket)}
              className={chipClass(selected)}
            >
              <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', getCategoryDotClass(bucket))} />
              {bucket}
            </Button>
          )
        })}
      </div>

      <div className="w-full shrink-0 sm:w-52">
        <CustomSelect
          ariaLabel={sortAriaLabel}
          value={sortOrder}
          onChange={onSortChange}
          options={sortOptions}
          className="w-full"
        />
      </div>
    </Toolbar>
  )
}
