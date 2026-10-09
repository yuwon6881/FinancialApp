import { Filter, X } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { CustomSelect } from '../../ui/CustomSelect'
import { Button } from '../../ui/Button'
import { DOCUMENT_SORT_OPTIONS, type DocumentSort } from '../../../lib/documentOrdering'

interface SelectedReliefCategory {
  id: string
  name: string
}

interface DocumentFilterBarProps {
  taxYear: number | undefined
  setTaxYear: (year: number | undefined) => void
  availableYears: number[]
  sortOrder: DocumentSort
  setSortOrder: (sort: DocumentSort) => void
  selectedReliefCategories?: SelectedReliefCategory[]
  onClearReliefCategory: (categoryId: string) => void
  onClearAllReliefCategories: () => void
}

export function DocumentFilterBar({
  taxYear,
  setTaxYear,
  availableYears,
  sortOrder,
  setSortOrder,
  selectedReliefCategories = [],
  onClearReliefCategory,
  onClearAllReliefCategories,
}: DocumentFilterBarProps) {
  const yearChip = (selected: boolean) => cn(
    'shrink-0 border px-3.5 tabular-nums',
    selected
      ? 'border-foreground/80 bg-card font-semibold text-foreground hover:bg-card'
      : 'border-border/70 font-medium text-muted-foreground hover:text-foreground',
  )

  return (
    <div data-testid="document-filter-bar" className="mb-3">
      {/* Years as chips, newest first, with the sort beside them: a handful of years never needed a
          dropdown to hide them in. */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filter by tax year" className="no-scrollbar -mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 py-0.5">
          {[...availableYears].sort((left, right) => right - left).map(year => (
            <Button
              key={year}
              variant="tertiary"
              size="sm"
              aria-pressed={taxYear === year}
              onClick={() => setTaxYear(year)}
              className={yearChip(taxYear === year)}
            >
              {year}
            </Button>
          ))}
          <Button
            variant="tertiary"
            size="sm"
            aria-pressed={taxYear === undefined}
            onClick={() => setTaxYear(undefined)}
            className={yearChip(taxYear === undefined)}
          >
            All years
          </Button>
        </div>
        <CustomSelect
          value={sortOrder}
          onChange={value => setSortOrder(value as DocumentSort)}
          options={DOCUMENT_SORT_OPTIONS.map(option => ({ ...option, label: `Sort: ${option.label}` }))}
          ariaLabel="Sort vault documents"
          className="w-full sm:w-48 sm:shrink-0"
        />
      </div>

      {selectedReliefCategories.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {selectedReliefCategories.map(category => (
            <Button
              key={category.id}
              variant="tertiary"
              type="button"
              onClick={() => onClearReliefCategory(category.id)}
              aria-label={`Clear ${category.name} relief filter`}
              className="inline-flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-between gap-2 rounded-full border border-primary/35 bg-primary/10 px-3.5 py-2 text-left text-caption font-semibold text-accent-ink transition hover:border-primary/60 hover:bg-primary/15 sm:min-h-9 sm:w-auto sm:max-w-64"
            >
              <span className="flex min-w-0 items-center gap-1.5 truncate"><Filter className="size-3.5 shrink-0" /> {category.name}</span>
              <X className="size-3.5 shrink-0" />
            </Button>
          ))}
          {selectedReliefCategories.length > 1 && (
            <Button
              variant="tertiary"
              type="button"
              onClick={onClearAllReliefCategories}
              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-border/60 px-3.5 py-2 text-caption font-semibold text-muted-foreground transition hover:bg-muted sm:min-h-9"
            >
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
