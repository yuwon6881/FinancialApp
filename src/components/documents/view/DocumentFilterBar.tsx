import { useRef, useState } from 'react'
import { Check, ChevronDown, ListFilter, X } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { useIsCompact } from '../../../lib/breakpoints'
import { CustomSelect } from '../../ui/CustomSelect'
import { Button } from '../../ui/Button'
import { AnchoredPopover } from '../../ui/AnchoredPopover'
import { BottomSheet } from '../../ui/BottomSheet'
import { DOCUMENT_SORT_OPTIONS, type DocumentSort } from '../../../lib/documentOrdering'

export interface ReliefFilterOption {
  id: string
  name: string
  /** Documents filed under it in the listed tax year; omitted when the list spans every year. */
  count?: number
}

interface DocumentFilterBarProps {
  taxYear: number | undefined
  setTaxYear: (year: number | undefined) => void
  availableYears: number[]
  sortOrder: DocumentSort
  setSortOrder: (sort: DocumentSort) => void
  /** Every relief category the documents can be narrowed to. */
  reliefOptions?: ReliefFilterOption[]
  /** The ids currently narrowing the list; several are OR'd. */
  selectedReliefIds?: string[]
  onToggleReliefCategory: (categoryId: string) => void
  onClearReliefCategory: (categoryId: string) => void
  onClearAllReliefCategories: () => void
}

/**
 * Everything that narrows the document list, in one place above it: the tax year as chips, a
 * Relief filter that says what it does, and the sort. The active relief filters repeat beneath as
 * removable chips, so what is hiding documents is always on screen next to them.
 *
 * The relief filter used to be the tracker's bars -- tapping a category's bar toggled it -- which
 * nothing on screen announced once the tracker became a plain list.
 */
export function DocumentFilterBar({
  taxYear,
  setTaxYear,
  availableYears,
  sortOrder,
  setSortOrder,
  reliefOptions = [],
  selectedReliefIds = [],
  onToggleReliefCategory,
  onClearReliefCategory,
  onClearAllReliefCategories,
}: DocumentFilterBarProps) {
  const isCompact = useIsCompact()
  const [isReliefOpen, setIsReliefOpen] = useState(false)
  const reliefButtonRef = useRef<HTMLButtonElement>(null)
  const selectedOptions = selectedReliefIds
    .map(id => reliefOptions.find(option => option.id === id))
    .filter((option): option is ReliefFilterOption => Boolean(option))
  const activeCount = selectedOptions.length

  const chip = (selected: boolean) => cn(
    'shrink-0 border px-3.5 tabular-nums',
    selected
      ? 'border-foreground/80 bg-card font-semibold text-foreground hover:bg-card'
      : 'border-border/70 font-medium text-muted-foreground hover:text-foreground',
  )

  const closeRelief = (restoreFocus: boolean) => {
    setIsReliefOpen(false)
    if (restoreFocus) reliefButtonRef.current?.focus()
  }

  const reliefList = (
    <ul aria-label="Relief categories" className="space-y-0.5">
      {reliefOptions.map(option => {
        const selected = selectedReliefIds.includes(option.id)
        return (
          <li key={option.id}>
            <Button
              variant="tertiary"
              type="button"
              aria-pressed={selected}
              onClick={() => onToggleReliefCategory(option.id)}
              className="min-h-11 w-full justify-start gap-3 rounded-control px-3 text-left font-normal lg:min-h-10"
            >
              <span className={cn(
                'grid size-5 shrink-0 place-items-center rounded-md border transition-colors',
                selected ? 'border-transparent bg-foreground text-background' : 'border-border',
              )}>
                {selected && <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />}
              </span>
              <span className={cn('min-w-0 flex-1 truncate text-body', selected && 'font-medium')}>{option.name}</span>
              {option.count !== undefined && (
                <span className="shrink-0 text-caption text-muted-foreground tabular-nums">{option.count}</span>
              )}
            </Button>
          </li>
        )
      })}
    </ul>
  )

  const clearAction = activeCount > 0 && (
    <Button variant="tertiary" size="sm" type="button" onClick={onClearAllReliefCategories} className="text-accent-ink">
      Clear
    </Button>
  )

  return (
    <div data-testid="document-filter-bar" className="@container mb-3">
      <div className="flex flex-col gap-2 @2xl:flex-row @2xl:items-center @2xl:justify-between">
        {/* Years as chips, newest first: a handful of years never needed a dropdown to hide in. */}
        <div role="group" aria-label="Filter by tax year" className="no-scrollbar -mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 py-0.5">
          {[...availableYears].sort((left, right) => right - left).map(year => (
            <Button
              key={year}
              variant="tertiary"
              size="sm"
              aria-pressed={taxYear === year}
              onClick={() => setTaxYear(year)}
              className={chip(taxYear === year)}
            >
              {year}
            </Button>
          ))}
          <Button
            variant="tertiary"
            size="sm"
            aria-pressed={taxYear === undefined}
            onClick={() => setTaxYear(undefined)}
            className={chip(taxYear === undefined)}
          >
            All years
          </Button>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          {reliefOptions.length > 0 && (
            <Button
              ref={reliefButtonRef}
              variant="secondary"
              size="sm"
              type="button"
              aria-haspopup="dialog"
              aria-expanded={isReliefOpen}
              aria-label={activeCount > 0
                ? `Filter documents by relief, ${activeCount} selected`
                : 'Filter documents by relief'}
              onClick={() => setIsReliefOpen(open => !open)}
              onKeyDown={event => {
                if (event.key === 'Escape' && isReliefOpen) {
                  event.preventDefault()
                  closeRelief(true)
                }
              }}
              className={cn(
                'shrink-0 gap-1.5 px-3.5',
                activeCount > 0 && 'border-primary/40 bg-primary/8 text-accent-ink hover:bg-primary/12 dark:bg-primary/12',
              )}
            >
              <ListFilter className="size-4" aria-hidden="true" />
              Relief
              {activeCount > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-caption font-semibold text-primary-foreground tabular-nums">
                  {activeCount}
                </span>
              )}
              <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', isReliefOpen && 'rotate-180')} aria-hidden="true" />
            </Button>
          )}
          <CustomSelect
            value={sortOrder}
            onChange={value => setSortOrder(value as DocumentSort)}
            options={DOCUMENT_SORT_OPTIONS.map(option => ({ ...option, label: `Sort: ${option.label}` }))}
            ariaLabel="Sort vault documents"
            align="right"
            className="min-w-0 flex-1 @md:w-48 @md:flex-none"
          />
        </div>
      </div>

      {activeCount > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Active relief filters" role="group">
          {selectedOptions.map(option => (
            <Button
              key={option.id}
              variant="tertiary"
              size="sm"
              type="button"
              onClick={() => onClearReliefCategory(option.id)}
              aria-label={`Clear ${option.name} relief filter`}
              className="max-w-full gap-1 border border-primary/30 bg-primary/8 pl-3.5 pr-2.5 font-medium text-accent-ink hover:bg-primary/14 dark:bg-primary/12"
            >
              <span className="truncate">{option.name}</span>
              <X className="size-3.5 shrink-0" aria-hidden="true" />
            </Button>
          ))}
          {activeCount > 1 && (
            <Button
              variant="tertiary"
              size="sm"
              type="button"
              onClick={onClearAllReliefCategories}
              className="text-muted-foreground"
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* A popover beside the button where there is room, a sheet on a phone -- the ledger's filter
          does the same. Each tick applies at once; there is nothing to confirm. */}
      <AnchoredPopover
        open={isReliefOpen && !isCompact}
        anchorRef={reliefButtonRef}
        align="right"
        side="bottom"
        minWidth={260}
        onDismiss={() => setIsReliefOpen(false)}
        role="dialog"
        aria-label="Filter documents by relief"
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            closeRelief(true)
          }
        }}
        className="z-[200] flex w-72 flex-col overflow-hidden rounded-overlay border border-border/70 bg-popover p-2 shadow-(--app-shadow-overlay)"
      >
        <div className="flex min-h-10 items-center justify-between gap-2 px-2 pb-1">
          <span className="text-label font-semibold text-foreground">Relief</span>
          {clearAction}
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain">{reliefList}</div>
      </AnchoredPopover>

      {isCompact && (
        <BottomSheet
          isOpen={isReliefOpen}
          title="Filter by relief"
          onClose={() => setIsReliefOpen(false)}
          headerActions={clearAction || undefined}
          footer={(
            <Button variant="primary" type="button" onClick={() => closeRelief(false)} className="w-full">
              Done
            </Button>
          )}
        >
          {reliefList}
        </BottomSheet>
      )}
    </div>
  )
}
