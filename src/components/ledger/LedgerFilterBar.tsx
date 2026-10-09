import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { cn } from '../../lib/utils'
import { useRef, useMemo } from 'react'
import { Search, Filter, X, Loader2, ChevronDown, Equal } from 'lucide-react'
import type { LedgerAccount, TransactionCategory } from '../../types'
import { allowsCategoryFlow } from '../../lib/categoryFlow'
import { BottomSheet } from '../ui/BottomSheet'
import { AnchoredPopover } from '../ui/AnchoredPopover'
import { CustomSelect } from '../ui/CustomSelect'
import {
  type TransactionLinkFilter,
  type TransactionSearchMode,
  type TransactionTypeFilterOption,
  type TxTypeFilter,
  type StabilityReloadFilter,
  parseTxTypes,
} from '../../lib/transactionFilters'
import type { TransactionSort } from '../../lib/transactionOrdering'
import { hasEffectiveAmountFilter, isUnusableAmountFilter } from './view/ledgerViewTypes'
import { LedgerAdvancedFilterControls } from './LedgerAdvancedFilterControls'
import { LedgerCategoryChecklist } from './LedgerCategoryChecklist'
import { Toolbar } from '../ui/Toolbar'

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
  reloadFilter?: StabilityReloadFilter
  onReloadFilterChange?: (value: StabilityReloadFilter) => void
  accounts: LedgerAccount[]
  accountIds: string[]
  onAccountToggle: (accountId: string) => void
  txType: TxTypeFilter
  onTxTypeChange: (value: TransactionTypeFilterOption | null) => void
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
  reloadFilter,
  onReloadFilterChange,
  accounts,
  accountIds,
  onAccountToggle,
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
  const activeTxTypes = parseTxTypes(txType)
  const activeFilterCount = (showAllCycles ? appliedFilters.length : selectedFilters.length) + activeAdvancedFilterCount
  // Names the filter trigger for assistive technology as well as sighted users: the visible
  // label is hidden below the expanded tier, leaving an icon-only button behind.
  const filterButtonLabel = showAllCycles
    ? (appliedFilters.length === 0 ? 'Filters' : `${appliedFilters.length} filter${appliedFilters.length > 1 ? 's' : ''} applied`)
    : (selectedFilters.length === 0 ? 'Filters' : `${selectedFilters.length} filter${selectedFilters.length > 1 ? 's' : ''} active`)
  const draftAdvancedFilterCount =
    (startDate || endDate ? 1 : 0) +
    (hasEffectiveAmountFilter(minAmount, maxAmount) ? 1 : 0) +
    (recurringFilter !== 'all' ? 1 : 0) +
    (wishlistFilter !== 'all' ? 1 : 0) +
    (reloadFilter && reloadFilter !== 'all' ? 1 : 0) +
    (accountIds.length > 0 ? 1 : 0) +
    (activeTxTypes.length > 0 ? 1 : 0)
  const draftFilterCount = checkboxFilters.length + draftAdvancedFilterCount
  const parsedMin = minAmount === '' ? undefined : Number(minAmount)
  const parsedMax = maxAmount === '' ? undefined : Number(maxAmount)
  const hasInvalidAmountRange = parsedMin !== undefined && parsedMax !== undefined && parsedMin > parsedMax
  // A bound the predicate drops has to say so, the same way an inverted range does. Left silent it
  // read as an applied filter that changed nothing.
  const hasUnusableAmount = isUnusableAmountFilter(minAmount) || isUnusableAmountFilter(maxAmount)
  const hasInvalidDateRange = !!startDate && !!endDate && startDate > endDate
  const hasInvalidRange = hasInvalidAmountRange || hasUnusableAmount || hasInvalidDateRange

  const availableCategories = useMemo(() => {
    return categories.filter(c => {
      if (c.isPendingDelete) return false
      if (activeTxTypes.length === 1 && (activeTxTypes[0] === 'inflow' || activeTxTypes[0] === 'outflow')) {
        return checkboxFilters.includes(c.name) || allowsCategoryFlow(c.type, activeTxTypes[0])
      }
      return true
    })
  }, [categories, activeTxTypes, checkboxFilters])

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
    hasUnusableAmount,
    txType,
    onTxTypeChange,
    recurringFilter,
    onRecurringFilterChange,
    wishlistFilter,
    onWishlistFilterChange,
    reloadFilter,
    onReloadFilterChange,
    accounts,
    accountIds,
    onAccountToggle,
  }

  const isExactMatch = searchMode === 'exact'
  // The match-mode switch lives inside the field it changes, the way a find bar puts it beside
  // the query; on its own the icon would be ambiguous and disconnected from the search it changes.
  const searchModeToggle = (
    <Button variant="tertiary"
      size="sm"
      type="button"
      aria-pressed={isExactMatch}
      aria-label={isExactMatch ? 'Matching complete fields exactly' : 'Matching anywhere in the text'}
      title={isExactMatch
        ? 'Exact match: "Badminton" skips "Badminton String". Tap to match anywhere in the text.'
        : 'Matching anywhere in the text: "Badminton" also finds "Badminton String". Tap to require an exact match.'}
      onClick={() => onSearchModeChange(isExactMatch ? 'contains' : 'exact')}
      className={cn('min-h-8 shrink-0 gap-1.5 px-2.5 text-caption lg:min-h-8', isExactMatch
        ? 'bg-primary/12 text-accent-ink hover:bg-primary/18'
        : 'text-muted-foreground hover:text-foreground')}
    >
      <Equal className="size-3.5 shrink-0" aria-hidden />
      <span className="hidden whitespace-nowrap xl:inline">Exact</span>
    </Button>
  )

  const searchField = (
    <div className="group flex h-11 min-w-0 flex-1 items-center gap-1 rounded-full border border-border/70 bg-card pl-4 pr-1 transition focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/20">
      <Search className="size-4 shrink-0 text-muted-foreground transition-colors group-focus-within:text-foreground" aria-hidden="true" />
      <Input
        type="text"
        placeholder="Search"
        aria-label={showAllCycles ? 'Search all transactions' : 'Search transactions'}
        value={showAllCycles ? pendingSearchTerm : searchTerm}
        onChange={e => (showAllCycles ? onPendingSearchChange(e.target.value) : onSearchTermChange(e.target.value))}
        onKeyDown={showAllCycles ? (e => { if (e.key === 'Enter') onServerSearch() }) : undefined}
        className="min-h-0 min-w-0 flex-1 rounded-none border-0 bg-transparent px-1.5 py-0 text-body shadow-none outline-none placeholder:text-subtle-foreground focus:border-transparent focus:bg-transparent focus:ring-0"
      />
      {(showAllCycles ? pendingSearchTerm : searchTerm) && (
        <IconButton
          type="button"
          label="Clear search"
          onClick={() => (showAllCycles ? onClearServerSearch() : onSearchTermChange(''))}
          className="size-8 text-muted-foreground hover:text-foreground lg:size-8"
        >
          <X className="size-3.5" />
        </IconButton>
      )}
      {searchModeToggle}
      {showAllCycles && (
        <Button
          variant="primary"
          size="sm"
          onClick={onServerSearch}
          disabled={serverIsFetching}
          className="min-h-9 shrink-0 px-3.5 lg:min-h-9"
        >
          {serverIsFetching
            ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            : <Search className="size-3.5" aria-hidden="true" />}
          <span>Search</span>
        </Button>
      )}
    </div>
  )

  const applyButton = (afterApply?: () => void) => (
    <Button
      variant="primary"
      onClick={() => {
        onApplyFilters()
        afterApply?.()
      }}
      disabled={serverIsFetching || hasInvalidRange}
      className="w-full"
    >
      {serverIsFetching
        ? <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        : <Filter className="size-4" aria-hidden="true" />}
      Apply filters
    </Button>
  )

  const clearAllButton = draftFilterCount > 0 && (
    <Button variant="tertiary" size="sm" onClick={onClearFilters} className="text-accent-ink">
      Clear all
    </Button>
  )

  return (
    <Toolbar
      aria-label="Ledger filters"
      className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-30 -mx-4 flex-nowrap gap-2 bg-background/90 px-4 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 sm:top-0 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      {searchField}

      <CustomSelect
        ariaLabel="Sort ledger transactions"
        value={sortOrder}
        onChange={onSortOrderChange}
        options={SORT_OPTIONS}
        align="right"
        variant="ghost"
        className="w-auto shrink-0"
      />

      <div
        className="ledger-filter-dropdown relative flex shrink-0 justify-end"
        onKeyDown={event => {
          if (!isMobile && isFilterDropdownOpen && event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onFilterDropdownOpenChange(false)
            filterButtonRef.current?.focus()
          }
        }}
      >
        <Button
          variant="secondary"
          ref={filterButtonRef}
          onClick={() => onFilterDropdownOpenChange(!isFilterDropdownOpen)}
          aria-haspopup="dialog"
          aria-expanded={isFilterDropdownOpen}
          aria-label={filterButtonLabel}
          className={cn('relative min-h-11 shrink-0 gap-2 px-3 lg:min-h-11 lg:px-4', activeFilterCount > 0 && 'border-primary/40 bg-primary/8 text-accent-ink hover:bg-primary/12')}
        >
          <Filter className="size-4" aria-hidden="true" />
          <span className="hidden lg:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-caption font-semibold text-primary-foreground tabular-nums">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={cn('hidden size-3.5 text-muted-foreground transition-transform lg:block', isFilterDropdownOpen && 'rotate-180')} aria-hidden="true" />
        </Button>

        <AnchoredPopover
          ref={filterPanelRef}
          open={isFilterDropdownOpen && !isMobile}
          anchorRef={filterButtonRef}
          align="right"
          side="bottom"
          role="dialog"
          aria-label="Filter ledger entries"
          className="ledger-filter-dropdown z-[200] flex w-[min(42rem,calc(100vw-16rem))] flex-col overflow-hidden rounded-overlay border border-border/70 bg-popover p-4 shadow-(--app-shadow-overlay) animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <span className="text-subsection text-foreground">Filters</span>
            {clearAllButton}
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

          {showAllCycles && <div className="mt-3 border-t border-border/60 pt-3">{applyButton()}</div>}
        </AnchoredPopover>

        {isMobile && (
          <BottomSheet
            isOpen={isFilterDropdownOpen}
            title="Filters"
            onClose={() => onFilterDropdownOpenChange(false)}
            headerActions={clearAllButton || undefined}
            footer={showAllCycles ? applyButton(() => onFilterDropdownOpenChange(false)) : undefined}
          >
            <div className="ledger-filter-dropdown space-y-5 pr-1">
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
    </Toolbar>
  )
}
