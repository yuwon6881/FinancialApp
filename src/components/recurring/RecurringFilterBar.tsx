import { Checkbox } from '../ui/Checkbox'
import { Button } from '../ui/Button'
import React from 'react'
import { CustomSelect } from '../ui/CustomSelect'
import { BottomSheet } from '../ui/BottomSheet'
import { AnchoredPopover } from '../ui/AnchoredPopover'
import { getCategoryDotClass, getCategoryFilterClass } from '../../lib/categoryColors'
import { ChevronDown } from 'lucide-react'

interface RecurringFilterBarProps {
  isMobile: boolean
  selectedCategories: string[]
  sortOrder: string
  isFilterDropdownOpen: boolean
  filterButtonRef: React.RefObject<HTMLButtonElement | null>
  setIsFilterDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>
  onToggleCategoryFilter: (cat: string) => void
  onClearFilters: () => void
  onSortChange: (value: string) => void
  allLabel?: string
  filterAriaLabel?: string
  sortAriaLabel?: string
  sortOptions?: Array<{ value: string; label: string }>
}

// Filter and Sort controls
export const RecurringFilterBar: React.FC<RecurringFilterBarProps> = ({
  isMobile,
  selectedCategories,
  sortOrder,
  isFilterDropdownOpen,
  filterButtonRef,
  setIsFilterDropdownOpen,
  onToggleCategoryFilter,
  onClearFilters,
  onSortChange,
  allLabel = 'All Categories',
  filterAriaLabel = 'Filter recurring payment categories',
  sortAriaLabel = 'Sort recurring payments',
  sortOptions = [
    { value: 'amount-desc', label: 'Sort by: Amount (High to Low)' },
    { value: 'amount-asc', label: 'Sort by: Amount (Low to High)' },
    { value: 'name-asc', label: 'Sort by: Name (A-Z)' },
    { value: 'due-date', label: 'Sort by: Next Due Date' },
  ],
}) => {
  const filterContainerRef = React.useRef<HTMLDivElement>(null)
  const filterPopoverRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!isFilterDropdownOpen || isMobile) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        filterContainerRef.current?.contains(target)
        || filterPopoverRef.current?.contains(target)
      ) {
        return
      }

      setIsFilterDropdownOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isFilterDropdownOpen, isMobile, setIsFilterDropdownOpen])

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-card border border-border/60 rounded-2xl shadow-xs select-none">
      {/* Category Multi-select dropdown */}
      <div
        ref={filterContainerRef}
        className="relative recurring-filter-dropdown w-full sm:w-auto"
        onKeyDown={event => {
          if (!isMobile && isFilterDropdownOpen && event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setIsFilterDropdownOpen(false)
            filterButtonRef.current?.focus()
          }
        }}
      >
        <Button variant="unstyled"
          ref={filterButtonRef}
          onClick={() => setIsFilterDropdownOpen(prev => !prev)}
          aria-haspopup="dialog"
          aria-expanded={isFilterDropdownOpen}
          className="w-full sm:w-60 flex items-center justify-between gap-2 px-4 py-2 text-xs font-semibold bg-background border border-border rounded-xl hover:bg-muted transition duration-200 cursor-pointer select-none border-border/60"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="truncate">
              {selectedCategories.length === 0
                ? allLabel
                : `${selectedCategories.length} category filter${selectedCategories.length > 1 ? 's' : ''} active`}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`size-3.5 text-muted-foreground/80 transition duration-200 ${isFilterDropdownOpen ? 'rotate-180' : ''}`}
          />
        </Button>

        {/* Desktop Filter Popover */}
        <AnchoredPopover
          ref={filterPopoverRef}
          open={isFilterDropdownOpen && !isMobile}
          anchorRef={filterButtonRef}
          align="left"
          side="bottom"
          role="dialog"
          aria-label={filterAriaLabel}
          className="recurring-filter-dropdown w-60 overflow-y-auto overscroll-contain bg-card border border-border rounded-2xl shadow-xl p-4 z-[200] animate-in fade-in slide-in-from-top-2 duration-150"
        >
            <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-3">
              <span className="text-xs font-bold text-foreground">Filter Categories</span>
              {selectedCategories.length > 0 && (
                <Button variant="unstyled"
                  onClick={onClearFilters}
                  className="text-[9px] font-bold text-orange-500 hover:underline cursor-pointer"
                >
                  Clear All
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-1.5 pr-1">
              {['Essentials', 'Growth', 'Stability', 'Rewards'].map(bucket => {
                const isChecked = selectedCategories.includes(bucket)
                return (
                  <label
                    key={bucket}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition ${getCategoryFilterClass(bucket, isChecked)}`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onChange={() => onToggleCategoryFilter(bucket)}
                      className="rounded border-border text-blue-500 focus:ring-ring size-3"
                    />
                    <span className={`size-2 rounded-full ${getCategoryDotClass(bucket)}`} />
                    <span>{bucket}</span>
                  </label>
                )
              })}
            </div>
        </AnchoredPopover>

        {/* Mobile BottomSheet Filter */}
        {isMobile && (
          <BottomSheet
            isOpen={isFilterDropdownOpen}
            title="Filter Categories"
            onClose={() => setIsFilterDropdownOpen(false)}
          >
            <div className="recurring-filter-dropdown space-y-4 pr-1">
              {selectedCategories.length > 0 && (
                <div className="flex justify-end">
                  <Button variant="unstyled"
                    onClick={onClearFilters}
                    className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                  >
                    Clear All
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-1 gap-2">
                {['Essentials', 'Growth', 'Stability', 'Rewards'].map(bucket => {
                  const isChecked = selectedCategories.includes(bucket)
                  return (
                    <label
                      key={bucket}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs cursor-pointer select-none transition ${getCategoryFilterClass(bucket, isChecked)}`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onChange={() => onToggleCategoryFilter(bucket)}
                        className="rounded border-border text-blue-500 focus:ring-ring size-3.5"
                      />
                      <span className={`size-2.5 rounded-full ${getCategoryDotClass(bucket)}`} />
                      <span className="font-semibold">{bucket}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </BottomSheet>
        )}
      </div>

      {/* Sort Select */}
      <div className="w-full sm:w-60">
        <CustomSelect
          ariaLabel={sortAriaLabel}
          value={sortOrder}
          onChange={(val) => onSortChange(val)}
          options={sortOptions}
          className="w-full"
        />
      </div>
    </div>
  )
}
