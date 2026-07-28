import { useRef } from 'react'
import { Search, Filter, X, Loader2, CalendarDays, Banknote, ChevronDown } from 'lucide-react'
import type { TransactionCategory } from '../../types'
import { BottomSheet } from '../ui/BottomSheet'
import { AnchoredPopover } from '../ui/AnchoredPopover'
import { CustomSelect } from '../ui/CustomSelect'
import { DatePicker } from '../ui/DatePicker'
import { PillSwitch } from '../ui/PillSwitch'
import { getCategoryDotClass, getCategoryFilterClass } from '../../lib/categoryColors'
import { LEDGER_BUCKETS as LEDGER_BUCKET_VALUES } from '../../lib/transactionFilters'
import type { TransactionSort } from '../../lib/transactionOrdering'

const LEDGER_BUCKETS: readonly string[] = LEDGER_BUCKET_VALUES
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
  // Server-mode search (committed on button/Enter)
  pendingSearchTerm: string
  onPendingSearchChange: (value: string) => void
  onServerSearch: () => void
  // Client-mode search (live filtering)
  searchTerm: string
  onSearchTermChange: (value: string) => void
  // Filter dropdown/sheet
  isFilterDropdownOpen: boolean
  onFilterDropdownOpenChange: (open: boolean) => void
  // Filter selections — pending is server-mode staging, selected is client-mode live
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
  recurringOnly: boolean
  onRecurringOnlyChange: (value: boolean) => void
  wishlistOnly: boolean
  onWishlistOnlyChange: (value: boolean) => void
  txType: 'inflow' | 'outflow' | 'transfer' | null
  onTxTypeChange: (value: 'inflow' | 'outflow' | 'transfer' | null) => void
  activeAdvancedFilterCount: number
  onClearFilters: () => void
  onApplyFilters: () => void
  sortOrder: TransactionSort
  onSortOrderChange: (value: TransactionSort) => void
}

// The sticky search + category-filter control. Renders a fused search+button
// pill in server (all-cycles) mode and a live-filtering input in client mode,
// plus a desktop popover and a mobile bottom sheet for the category filters.
export function LedgerFilterBar({
  showAllCycles,
  isMobile,
  serverIsFetching,
  categories,
  pendingSearchTerm,
  onPendingSearchChange,
  onServerSearch,
  searchTerm,
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
  recurringOnly,
  onRecurringOnlyChange,
  wishlistOnly,
  onWishlistOnlyChange,
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
  // Which selection set is authoritative for the checkbox state depends on mode.
  const checkboxFilters = showAllCycles ? pendingFilters : selectedFilters
  const activeFilterCount = (showAllCycles ? appliedFilters.length : selectedFilters.length) + activeAdvancedFilterCount
  const draftAdvancedFilterCount =
    (startDate || endDate ? 1 : 0) +
    (minAmount || maxAmount ? 1 : 0) +
    (recurringOnly ? 1 : 0) +
    (wishlistOnly ? 1 : 0) +
    (txType ? 1 : 0)
  const draftFilterCount = checkboxFilters.length + draftAdvancedFilterCount
  const parsedMin = minAmount === '' ? undefined : Number(minAmount)
  const parsedMax = maxAmount === '' ? undefined : Number(maxAmount)
  const hasInvalidAmountRange = parsedMin !== undefined && parsedMax !== undefined && parsedMin > parsedMax
  const hasInvalidDateRange = !!startDate && !!endDate && startDate > endDate
  const hasInvalidRange = hasInvalidAmountRange || hasInvalidDateRange

  const advancedFilterControls = (
    <div className="space-y-4 border-t border-border/40 pt-4 md:border-t-0 md:pt-0">
      <div className="space-y-2">
        <span className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <CalendarDays className="size-3" /> Date range
        </span>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[10px] font-semibold text-muted-foreground">
            From
            <DatePicker
              value={startDate}
              max={endDate || undefined}
              onChange={onStartDateChange}
              clearable
              clearAriaLabel="Clear ledger from date"
              className="w-full"
              popoverClassName="ledger-filter-dropdown"
            />
          </label>
          <label className="space-y-1 text-[10px] font-semibold text-muted-foreground">
            To
            <DatePicker
              value={endDate}
              min={startDate || undefined}
              onChange={onEndDateChange}
              clearable
              clearAriaLabel="Clear ledger to date"
              className="w-full"
              popoverClassName="ledger-filter-dropdown"
            />
          </label>
        </div>
        {hasInvalidDateRange && <p className="text-[10px] font-semibold text-red-500">Start date must be before the end date.</p>}
      </div>

      <div className="space-y-2">
        <span className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <Banknote className="size-3" /> Amount range
        </span>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[10px] font-semibold text-muted-foreground">
            Minimum
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={minAmount}
              onChange={event => onMinAmountChange(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </label>
          <label className="space-y-1 text-[10px] font-semibold text-muted-foreground">
            Maximum
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="Any"
              value={maxAmount}
              onChange={event => onMaxAmountChange(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </label>
        </div>
        <p className="text-[9px] text-muted-foreground">Uses the absolute amount for both inflows and outflows.</p>
        {hasInvalidAmountRange && <p className="text-[10px] font-semibold text-red-500">Minimum amount cannot exceed maximum amount.</p>}
      </div>

      <div className="space-y-2">
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Transaction type</span>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            [null, 'All types'],
            ['inflow', 'Inflow'],
            ['outflow', 'Outflow'],
            ['transfer', 'Transfer'],
          ] as const).map(([value, label]) => (
            <button
              type="button"
              key={label}
              onClick={() => onTxTypeChange(value)}
              className={`rounded-lg border px-2 py-2 text-[10px] font-semibold transition cursor-pointer ${
                txType === value
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-500'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {([
        ['Recurring transactions only', recurringOnly, onRecurringOnlyChange],
        ['Wishlist purchases only', wishlistOnly, onWishlistOnlyChange],
      ] as const).map(([label, checked, onChange]) => (
        <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <PillSwitch checked={checked} onChange={onChange} ariaLabel={label} />
        </div>
      ))}
    </div>
  )

  return (
    <div
      style={{ top: 'calc(4rem + env(safe-area-inset-top, 0px))' }}
      // The translucency + blur is desktop-only. This bar is sticky over the ledger, so on
      // a phone its blurred backdrop had to be re-filtered against freshly painted rows for
      // every frame of every scroll — the single most expensive thing on the screen on
      // mid-range Android. Phones get an opaque `bg-card` and no filter instead.
      className="sticky z-30 flex flex-row items-center justify-between gap-2 md:gap-4 p-2 md:p-4 bg-card md:bg-card/90 md:supports-[backdrop-filter]:bg-card/75 md:backdrop-blur-md border border-border/60 rounded-xl md:rounded-2xl shadow-sm"
    >
      {showAllCycles ? (
        /* Server mode: input pill + Search button fused into one focus-aware
           control so the two read as a single element rather than two boxes. */
        <div className="group flex min-w-0 flex-1 items-stretch md:w-auto overflow-hidden rounded-xl border border-border bg-card shadow-sm transition duration-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-ring/25 hover:border-blue-500/50">
          <div className="flex min-w-0 flex-1 items-center md:w-80">
            <Search className="ml-3 size-4 shrink-0 text-foreground transition-colors group-focus-within:text-blue-500" />
            <input
              type="text"
              placeholder="Search all transactions..."
              value={pendingSearchTerm}
              onChange={e => onPendingSearchChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onServerSearch() }}
              className="min-w-0 flex-1 bg-transparent px-2.5 py-2.5 text-xs text-foreground outline-none placeholder:text-foreground/60"
            />
            {pendingSearchTerm && (
              <button
                type="button"
                onClick={() => onPendingSearchChange('')}
                aria-label="Clear search"
                className="mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-muted transition cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={onServerSearch}
            disabled={serverIsFetching}
            className="flex min-h-10 shrink-0 items-center justify-center gap-1.5 border-l border-border/50 bg-primary px-3.5 py-2.5 text-xs font-semibold text-primary-foreground whitespace-nowrap transition-colors duration-200 hover:bg-primary/90 active:bg-primary/80 disabled:cursor-wait cursor-pointer md:px-5"
          >
            {serverIsFetching
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Search className="size-3.5" />}
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>
      ) : (
        /* Client mode: live-filtering search input with a clear affordance. */
        <div className="group relative flex-1 md:w-72 md:flex-initial">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-blue-500" />
          <input
            type="text"
            placeholder="Search description, category..."
            value={searchTerm}
            onChange={e => onSearchTermChange(e.target.value)}
            className="w-full rounded-xl border border-border/70 bg-background py-2.5 pl-9 pr-9 text-xs shadow-sm outline-none transition duration-200 hover:border-border focus:border-ring/50 focus:ring-2 focus:ring-ring/25"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchTermChange('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2">
        <CustomSelect
          ariaLabel="Sort ledger transactions"
          value={sortOrder}
          onChange={onSortOrderChange}
          options={SORT_OPTIONS}
          align="right"
          className="w-28 sm:w-40"
        />

        {/* Dropdown Multi-Select Category Filter */}
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
        <button
          ref={filterButtonRef}
          onClick={() => onFilterDropdownOpenChange(!isFilterDropdownOpen)}
          aria-haspopup="dialog"
          aria-expanded={isFilterDropdownOpen}
          className="relative flex items-center justify-center md:justify-between gap-2 shrink-0 px-3 md:px-4 py-2.5 md:w-60 text-xs font-semibold bg-background border border-border/60 rounded-xl hover:bg-muted transition duration-200 cursor-pointer select-none"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <Filter className="size-4 md:size-3.5" />
            <span className="hidden md:inline truncate">
              {showAllCycles
                ? (appliedFilters.length === 0 ? 'Filters' : `${appliedFilters.length} filter${appliedFilters.length > 1 ? 's' : ''} applied`)
                : (selectedFilters.length === 0 ? 'Filters' : `${selectedFilters.length} filter${selectedFilters.length > 1 ? 's' : ''} active`)}
            </span>
          </span>
          <ChevronDown className={`hidden size-3.5 text-muted-foreground transition-transform md:block ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
          {activeFilterCount > 0 && (
            <span className="md:hidden absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Desktop Filter Popover */}
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
            {/* Header */}
            <div className="mb-3 flex shrink-0 items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-bold text-foreground">Filter Ledger Entries</span>
              {draftFilterCount > 0 && (
                <button
                  onClick={onClearFilters}
                  className="text-[9px] font-bold text-orange-500 hover:underline cursor-pointer whitespace-nowrap"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Two columns keep every control visible on a typical desktop while
                the outer body remains the single fallback scroll container. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-4">
                  {/* Section 1: Ledger Allocation Buckets */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Ledger Categories</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {LEDGER_BUCKETS.map(bucket => {
                        const isChecked = checkboxFilters.includes(bucket)
                        return (
                          <label
                            key={bucket}
                            className={`flex min-w-0 items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition ${getCategoryFilterClass(bucket, isChecked)}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => onToggleFilter(bucket)}
                              className="rounded border-border text-blue-500 focus:ring-ring size-3"
                            />
                            <span className={`size-2 shrink-0 rounded-full ${getCategoryDotClass(bucket)}`} />
                            <span className="truncate">{bucket}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* Section 2: Transaction Categories */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Categories</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {categories.map(c => {
                        const isChecked = checkboxFilters.includes(c.name)
                        return (
                          <label
                            key={c.id}
                            className={`flex min-w-0 items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition ${getCategoryFilterClass(c.name, isChecked)}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => onToggleFilter(c.name)}
                              className="rounded border-border text-blue-500 focus:ring-ring size-3"
                            />
                            <span className={`size-2 shrink-0 rounded-full ${getCategoryDotClass(c.name)}`} />
                            <span className="truncate">{c.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
                {advancedFilterControls}
              </div>
            </div>

            {/* Apply button -- only in server mode */}
            {showAllCycles && (
              <div className="pt-3 mt-3 border-t border-border/40">
                <button
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
                </button>
              </div>
            )}
        </AnchoredPopover>

        {/* Mobile BottomSheet Filter */}
        {isMobile && (
          <BottomSheet
            isOpen={isFilterDropdownOpen}
            title="Filter Ledger Entries"
            onClose={() => onFilterDropdownOpenChange(false)}
            footer={showAllCycles ? (
              <button
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
              </button>
            ) : undefined}
          >
            <div className="ledger-filter-dropdown space-y-4 pr-1">
              {draftFilterCount > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={onClearFilters}
                    className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              )}

              {/* Section 1: Ledger Allocation Buckets */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Ledger Categories</span>
                <div className="grid grid-cols-1 gap-1.5">
                  {LEDGER_BUCKETS.map(bucket => {
                    const isChecked = checkboxFilters.includes(bucket)
                    return (
                      <label
                        key={bucket}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer select-none transition ${getCategoryFilterClass(bucket, isChecked)}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggleFilter(bucket)}
                          className="rounded border-border text-blue-500 focus:ring-ring size-3.5"
                        />
                        <span className={`size-2.5 rounded-full ${getCategoryDotClass(bucket)}`} />
                        <span className="font-semibold">{bucket}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Section 2: Transaction Categories */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Categories</span>
                <div className="grid grid-cols-1 gap-1.5 pr-0.5">
                  {categories.map(c => {
                    const isChecked = checkboxFilters.includes(c.name)
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer select-none transition ${getCategoryFilterClass(c.name, isChecked)}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggleFilter(c.name)}
                          className="rounded border-border text-blue-500 focus:ring-ring size-3.5"
                        />
                        <span className={`size-2.5 rounded-full ${getCategoryDotClass(c.name)}`} />
                        <span className="font-semibold truncate">{c.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {advancedFilterControls}
            </div>
          </BottomSheet>
        )}
        </div>
      </div>
    </div>
  )
}
