import { Filter, X } from 'lucide-react'
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
  return (
    <div data-testid="document-filter-bar" className="mb-3 rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Hidden below sm, where it spent a whole line telling a phone what two labelled selects
            already say. The group keeps the name for screen readers either way. */}
        <span className="hidden items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground sm:flex">
          <Filter className="size-3.5" aria-hidden="true" />
          Document filters
        </span>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto" role="group" aria-label="Document filters">
          <CustomSelect
            value={sortOrder}
            onChange={value => setSortOrder(value as DocumentSort)}
            options={DOCUMENT_SORT_OPTIONS.map(option => ({ ...option, label: `Sort: ${option.label}` }))}
            ariaLabel="Sort vault documents"
            className="w-full sm:w-44 sm:shrink-0"
          />
          <CustomSelect
            value={taxYear ?? ''}
            onChange={value => setTaxYear(value === '' ? undefined : Number(value))}
            options={[
              { value: '', label: 'All tax years' },
              ...availableYears.map(year => ({ value: year, label: `Tax year: ${year}` })),
            ]}
            ariaLabel="Filter by tax year"
            className="w-full sm:w-40 sm:shrink-0"
          />
        </div>
      </div>

      {selectedReliefCategories.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {selectedReliefCategories.map(category => (
            <Button
              key={category.id}
              variant="unstyled"
              type="button"
              onClick={() => onClearReliefCategory(category.id)}
              aria-label={`Clear ${category.name} relief filter`}
              className="inline-flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-between gap-2 rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 text-left text-xs font-semibold text-accent-ink transition hover:border-primary/60 hover:bg-primary/15 sm:min-h-9 sm:w-auto sm:max-w-64"
            >
              <span className="flex min-w-0 items-center gap-1.5 truncate"><Filter className="size-3.5 shrink-0" /> {category.name}</span>
              <X className="size-3.5 shrink-0" />
            </Button>
          ))}
          {selectedReliefCategories.length > 1 && (
            <Button
              variant="unstyled"
              type="button"
              onClick={onClearAllReliefCategories}
              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-border/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted sm:min-h-9"
            >
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
