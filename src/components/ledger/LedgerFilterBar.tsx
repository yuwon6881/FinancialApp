import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { useRef, useMemo } from 'react'
import { Search, Filter, X, Loader2, ChevronDown, Equal } from 'lucide-react'
import type { TransactionCategory } from '../../types'
import { allowsCategoryFlow } from '../../lib/categoryFlow'
import { BottomSheet } from '../ui/BottomSheet'
import { AnchoredPopover } from '../ui/AnchoredPopover'
import { CustomSelect } from '../ui/CustomSelect'
import type { TransactionLinkFilter, TransactionSearchMode } from '../../lib/transactionFilters'
import type { TransactionSort } from '../../lib/transactionOrdering'
import { LedgerAdvancedFilterControls } from './LedgerAdvancedFilterControls'
import { LedgerCategoryChecklist } from './LedgerCategoryChecklist'

const SORT_OPTIONS: { value: TransactionSort; label: string }[] = [
  { value: 'date-desc', label: 'Newest' },
  { value: 'date-asc', label: 'Oldest' },
  { value: 'amount-desc', label: 'Amount high' },
  { value: 'amount-asc', label: 'Amount low' },
]

interface LedgerFilterBarProps {
  showAllCycles: boolean
  isMobile: boolean
  serverIsFetching: boolean
  categories: TransactionCategory[]
  pendingSearchTerm: string
  onPendingSearchChange: (value: string) => void
  onServerSearch: () => void
  onClearServerSearch: () => void
  searchTerm: string
  searchMode: TransactionSearchMode
  onSearchModeChange: (mode: TransactionSearchMode) => void
  onSearchTermChange: (value: string) => void
  isFilterDropdownOpen: boolean
  onFilterDropdownOpenChange: (open: boolean) => void
  appliedFilters: string[]
  pendingFilters: string[]
  selectedFilters: string[]
  onToggleFilter: (filterName: string) => void
  startDate: string
  onStartDateChange: (value: string) => void
  endDate: string
  onEndDateChange: (value: string) => void
  minAmount: string
  onMinAmountChange: (value: string) => void
  maxAmount: string
  onMaxAmountChange: (value: string) => void
  recurringFilter: TransactionLinkFilter
  onRecurringFilterChange: (value: TransactionLinkFilter) => void
  wishlistFilter: TransactionLinkFilter
  onWishlistFilterChange: (value: TransactionLinkFilter) => void
  txType: 'inflow' | 'outflow' | 'transfer' | null
  onTxTypeChange: (value: 'inflow' | 'outflow' | 'transfer' | null) => void
  activeAdvancedFilterCount: number
  onClearFilters: () => void
  onApplyFilters: () => void
  sortOrder: TransactionSort
  onSortOrderChange: (value: TransactionSort) => void
}

export function LedgerFilterBar({
  showAllCycles,
  isMobile,
  serverIsFetching,
  categories,
  pendingSearchTerm,
  onPendingSearchChange,
  onServerSearch,
  onClearServerSearch,
  searchTerm,
  searchMode,
  onSearchModeChange,
  onSearchTermChange,
  isFilterDropdownOpen,
  onFilterDropdownOpenChange,
  appliedFilters,
  pendingFilters,
  selectedFilters,
  onToggleFilter,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  minAmount,
  onMinAmountChange,
  maxAmount,
  onMaxAmountChange,
  recurringFilter,
  onRecurringFilterChange,
  wishlistFilter,
  onWishlistFilterChange,
  txType,
  onTxTypeChange,
  activeAdvancedFilterCount,
  onClearFilters,
  onApplyFilters,
  sortOrder,
  onSortOrderChange,
}: LedgerFilterBarProps) {
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)
  const checkboxFilters = showAllCycles ? pendingFilters : selectedFilters
  const activeFilterCount = (showAllCycles ? appliedFilters.length : selectedFilters.length) + activeAdvancedFilterCount
  const draftAdvancedFilterCount =
    (startDate || endDate ? 1 : 0) +
    (minAmount || maxAmount ? 1 : 0) +
    (recurringFilter !== 'all' ? 1 : 0) +
    (wishlistFilter !== 'all' ? 1 : 0) +
    (txType ? 1 : 0)
  const draftFilterCount = checkboxFilters.length + draftAdvancedFilterCount
  const parsedMin = minAmount === '' ? undefined : Number(minAmount)
  const parsedMax = maxAmount === '' ? undefined : Number(maxAmount)
  const hasInvalidAmountRange = parsedMin !== undefined && parsedMax !== undefined && parsedMin > parsedMax
  const hasInvalidDateRange = !!startDate && !!endDate && startDate > endDate
  const hasInvalidRange = hasInvalidAmountRange || hasInvalidDateRange

  const availableCategories = useMemo(() => {
    return categories.filter(c => {
      if (c.isPendingDelete) return false
      if (txType === 'inflow' || txType === 'outflow') {
        return checkboxFilters.includes(c.name) || allowsCategoryFlow(c.type, txType)
      }
      return true
    })
  }, [categories, txType, checkboxFilters])

  const advancedFilterProps = {
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    hasInvalidDateRange,
    minAmount,
    onMinAmountChange,
    maxAmount,
    onMaxAmountChange,
    hasInvalidAmountRange,
    txType,
    onTxTypeChange,
    recurringFilter,
    onRecurringFilterChange,
    wishlistFilter,
    onWishlistFilterChange,
  }

  const isExactMatch = searchMode === 'exact'
  // The match-mode switch lives inside the field it changes, the way a find bar puts it beside
  // the query; on its own the icon would be ambiguous and disconnected from the search it changes.
  const searchModeToggle = (
    <Button variant="unstyled"
      type="button"
      aria-pressed={isExactMatch}
      aria-label={isExactMatch ? 'Matching complete fields exactly' : 'Matching anywhere in the text'}
      title={isExactMatch
        ? 'Exact match: "Badminton" skips "Badminton String". Tap to match anywhere in the text.'
        : 'Matching anywhere in the text: "Badminton" also finds "Badminton String". Tap to require an exact match.'}
      onClick={() => onSearchModeChange(isExactMatch ? 'contains' : 'exact')}
      className={`mr-1.5 flex size-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-1.5 text-[10px] font-bold transition cursor-pointer lg:w-auto ${isExactMatch
        ? 'border-primary/45 bg-primary/15 text-accent-ink'
        : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'}`}
    >
      <Equal className="size-4 shrink-0" aria-hidden />
      <span className="hidden lg:inline whitespace-nowrap">Exact match</span>
    </Button>
  )

  return (
    <div className="top-[calc(4rem+env(safe-area-inset-top,0px))] sticky z-30 flex flex-wrap items-center gap-2 lg:gap-4 p-2 lg:p-4 bg-card lg:bg-card/90 lg:supports-[backdrop-filter]:bg-card/75 lg:backdrop-blur-md border border-border/60 rounded-xl lg:rounded-2xl shadow-sm">
      {/* The search field takes a phone row of its own: sharing one row with the sort and filter
          controls squeezed it down to little more than its own magnifier icon. */}
      <div className="w-full min-w-0 lg:w-auto lg:flex-1">
        {showAllCycles ? (
          <div className="group flex min-w-0 items-stretch overflow-hidden rounded-xl border border-border bg-card shadow-sm transition duration-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-ring/25 hover:border-blue-500/50 lg:max-w-xl">
            <div className="flex min-w-0 flex-1 items-center">
              <Search className="ml-3 size-4 shrink-0 text-foreground transition-colors group-focus-within:text-blue-500" />
              <Input
                type="text"
                placeholder="Search all transactions..."
                value={pendingSearchTerm}
                onChange={e => onPendingSearchChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onServerSearch() }}
                className="min-w-0 flex-1 rounded-none border-0 bg-transparent px-2.5 py-2.5 text-xs text-foreground shadow-none outline-none placeholder:text-foreground/60 focus:border-transparent focus:ring-0"
              />
              {pendingSearchTerm && (
                <Button variant="unstyled"
                  type="button"
                  onClick={onClearServerSearch}
                  aria-label="Clear search"
                  className="mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-muted transition cursor-pointer"
                >
                  <X className="size-3.5" />
                </Button>
              )}
              {searchModeToggle}
            </div>
            <Button variant="unstyled"
              onClick={onServerSearch}
              disabled={serverIsFetching}
              className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 border-l border-border/50 bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground whitespace-nowrap transition-colors duration-200 hover:bg-primary/90 active:bg-primary/80 disabled:cursor-wait cursor-pointer lg:px-5"
            >
              {serverIsFetching
                ? <Loader2 className="size-3.5 animate-spin" />
                : <Search className="size-3.5" />}
              <span>Search</span>
            </Button>
          </div>
        ) : (
          <div className="group flex min-w-0 items-center gap-1 rounded-xl border border-border/70 bg-background pl-3 shadow-sm transition duration-200 hover:border-border focus-within:border-ring/50 focus-within:ring-2 focus-within:ring-ring/25 lg:max-w-md">
            <Search className="size-4 shrink-0 text-muted-foreground transition-colors group-focus-within:text-blue-500" />
            <Input
              type="text"
              placeholder="Search description, category..."
              value={searchTerm}
              onChange={e => onSearchTermChange(e.target.value)}
              className="min-w-0 flex-1 rounded-none border-0 bg-transparent px-2 py-2.5 text-xs shadow-none outline-none focus:border-transparent focus:ring-0"
            />
            {searchTerm && (
              <Button variant="unstyled"
                type="button"
                onClick={() => onSearchTermChange('')}
                aria-label="Clear search"
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
              >
                <X className="size-3.5" />
              </Button>
            )}
            {searchModeToggle}
          </div>
        )}
      </div>

      <div className="flex w-full shrink-0 items-center justify-between gap-2 lg:w-auto lg:justify-end">
        <CustomSelect
          ariaLabel="Sort ledger transactions"
          value={sortOrder}
          onChange={onSortOrderChange}
          options={SORT_OPTIONS}
          align="right"
          className="w-28 sm:w-40"
        />

        <div
          className="relative ledger-filter-dropdown shrink-0 flex justify-end"
          onKeyDown={event => {
            if (!isMobile && isFilterDropdownOpen && event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              onFilterDropdownOpenChange(false)
              filterButtonRef.current?.focus()
            }
          }}
        >
          <Button variant="unstyled"
            ref={filterButtonRef}
            onClick={() => onFilterDropdownOpenChange(!isFilterDropdownOpen)}
            aria-haspopup="dialog"
            aria-expanded={isFilterDropdownOpen}
            className="relative flex items-center justify-center lg:justify-between gap-2 shrink-0 px-3 lg:px-4 py-2.5 lg:w-60 text-xs font-semibold bg-background border border-border/60 rounded-xl hover:bg-muted transition duration-200 cursor-pointer select-none"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <Filter className="size-4 lg:size-3.5" />
              <span className="hidden lg:inline truncate">
                {showAllCycles
                  ? (appliedFilters.length === 0 ? 'Filters' : `${appliedFilters.length} filter${appliedFilters.length > 1 ? 's' : ''} applied`)
                  : (selectedFilters.length === 0 ? 'Filters' : `${selectedFilters.length} filter${selectedFilters.length > 1 ? 's' : ''} active`)}
              </span>
            </span>
            <ChevronDown className={`hidden size-3.5 text-muted-foreground transition-transform lg:block ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
            {activeFilterCount > 0 && (
              <span className="lg:hidden absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>

          <AnchoredPopover
            ref={filterPanelRef}
            open={isFilterDropdownOpen && !isMobile}
            anchorRef={filterButtonRef}
            align="right"
            side="bottom"
            role="dialog"
            aria-label="Filter ledger entries"
            className="ledger-filter-dropdown flex w-[42rem] flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-xl z-[200] animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <div className="mb-3 flex shrink-0 items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-bold text-foreground">Filter Ledger Entries</span>
              {draftFilterCount > 0 && (
                <Button variant="unstyled"
                  onClick={onClearFilters}
                  className="text-[9px] font-bold text-orange-500 hover:underline cursor-pointer whitespace-nowrap"
                >
                  Clear All
                </Button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
              <div className="grid grid-cols-2 gap-5">
                <LedgerCategoryChecklist
                  checkboxFilters={checkboxFilters}
                  availableCategories={availableCategories}
                  onToggleFilter={onToggleFilter}
                  isMobile={false}
                />
                <LedgerAdvancedFilterControls {...advancedFilterProps} />
              </div>
            </div>

            {showAllCycles && (
              <div className="pt-3 mt-3 border-t border-border/40">
                <Button variant="unstyled"
                  onClick={onApplyFilters}
                  disabled={serverIsFetching || hasInvalidRange}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs cursor-pointer transition duration-200 disabled:opacity-50
                    bg-primary hover:bg-primary/90
                    text-primary-foreground shadow-md shadow-primary/20 hover:shadow-primary/30"
                >
                  {serverIsFetching
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : <Filter className="size-3.5" />}
                  Apply Filters
                </Button>
              </div>
            )}
          </AnchoredPopover>

          {isMobile && (
            <BottomSheet
              isOpen={isFilterDropdownOpen}
              title="Filter Ledger Entries"
              onClose={() => onFilterDropdownOpenChange(false)}
              footer={showAllCycles ? (
                <Button variant="unstyled"
                  onClick={() => {
                    onApplyFilters()
                    onFilterDropdownOpenChange(false)
                  }}
                  disabled={serverIsFetching || hasInvalidRange}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs cursor-pointer transition duration-200 disabled:opacity-50
                    bg-primary hover:bg-primary/90
                    text-primary-foreground shadow-md shadow-primary/20 hover:shadow-primary/30"
                >
                  {serverIsFetching
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : <Filter className="size-3.5" />}
                  Apply Filters
                </Button>
              ) : undefined}
            >
              <div className="ledger-filter-dropdown space-y-4 pr-1">
                {draftFilterCount > 0 && (
                  <div className="flex justify-end">
                    <Button variant="unstyled"
                      onClick={onClearFilters}
                      className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                    >
                      Clear All
                    </Button>
                  </div>
                )}
                <LedgerCategoryChecklist
                  checkboxFilters={checkboxFilters}
                  availableCategories={availableCategories}
                  onToggleFilter={onToggleFilter}
                  isMobile={true}
                />
                <LedgerAdvancedFilterControls {...advancedFilterProps} />
              </div>
            </BottomSheet>
          )}
        </div>
      </div>
    </div>
  )
}
