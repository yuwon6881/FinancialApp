import { useEffect, useRef, type ReactNode } from 'react'
import { Checkbox } from './Checkbox'
import { Button } from './Button'

export interface SelectionToolbarProps {
  itemCount: number
  selectedCount: number
  allVisibleSelected: boolean
  someVisibleSelected: boolean
  isSelecting: boolean
  onStartSelection: () => void
  onToggleSelectAll: () => void
  onLeaveSelection: () => void
  actions?: ReactNode
  disabled?: boolean
  selectionLimit?: number
  itemLabel?: string
  selectedLabel?: string
  testId?: string
  actionsTestId?: string
}

/**
 * Stable bulk-selection shell shared by Vault and Ledger. The action slot grows
 * leftward while Done remains the final child, so entering selection mode never
 * moves the list or the select-page checkbox.
 */
export function SelectionToolbar({
  itemCount,
  selectedCount,
  allVisibleSelected,
  someVisibleSelected,
  isSelecting,
  onStartSelection,
  onToggleSelectAll,
  onLeaveSelection,
  actions,
  disabled = false,
  selectionLimit = 100,
  itemLabel = 'items',
  selectedLabel = 'selected',
  testId = 'selection-toolbar',
  actionsTestId,
}: SelectionToolbarProps) {
  const checkboxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = someVisibleSelected
  }, [someVisibleSelected])

  const exceedsLimit = selectedCount > selectionLimit
  const hasSelection = selectedCount > 0

  return (
    <div data-testid={testId} className={`mb-3 grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${hasSelection ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-muted/20'}`}>
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
        {isSelecting && (
          <>
            <label className={`-mx-1.5 inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 transition sm:min-h-9 ${itemCount > 0 ? 'cursor-pointer hover:bg-muted' : 'opacity-60'}`}>
              <Checkbox
                ref={checkboxRef}
                checked={allVisibleSelected}
                onChange={onToggleSelectAll}
                disabled={disabled || itemCount === 0}
                aria-label={allVisibleSelected ? `Clear ${itemLabel} selection on this page` : `Select all ${itemLabel} on this page`}
                className="size-4 border-primary/50 bg-card accent-primary"
              />
              <span className="truncate text-[10px] font-black uppercase tracking-wide text-foreground">Select page</span>
            </label>
            <span className="hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden="true" />
          </>
        )}
        <p className={`truncate text-[10px] font-semibold sm:text-xs ${exceedsLimit ? 'text-destructive' : hasSelection ? 'text-accent-ink' : 'text-muted-foreground'}`} aria-live="polite">
          {hasSelection ? `${selectedCount} ${selectedLabel}${exceedsLimit ? ` · max ${selectionLimit}` : ''}` : `${itemCount} on this page`}
        </p>
      </div>

      <div data-testid={actionsTestId ?? `${testId}-actions`} className="flex shrink-0 items-center justify-end gap-1.5">
        {!isSelecting ? (
          <Button variant="outline" size="sm" type="button" disabled={disabled || itemCount === 0} onClick={onStartSelection} className="min-h-11 bg-card sm:min-h-0">
            Select
          </Button>
        ) : (
          <>
            {actions}
            <Button variant="outline" size="sm" type="button" onClick={onLeaveSelection} aria-label="Leave selection mode" className="min-h-11 shrink-0 bg-card sm:min-h-0">
              Done
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
