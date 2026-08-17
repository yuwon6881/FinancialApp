import { Layers, Search, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { SearchResultRow } from './SearchResultRow'
import { useGlobalSearch } from './useGlobalSearch'
import type { SearchResult, SearchSourceData } from '../../lib/search/searchSources'

export interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
  data: SearchSourceData
  onOpenResult: (result: SearchResult) => void
  onSearchAllCycles: (query: string) => void
  /** Formats an amount, already masked when sensitive mode is on. Returns a plain string. */
  formatAmount: (amount: number) => string
  /**
   * True while amounts are masked. Amounts still render (as the mask, like every other surface)
   * but stop being matchable, so a query cannot confirm a figure the mask is withholding.
   */
  maskAmounts: boolean
  /** The lazy loan list is being fetched because search was opened before the Loans tab. */
  isLoadingLoans?: boolean
}

export function GlobalSearch({
  isOpen,
  onClose,
  data,
  onOpenResult,
  onSearchAllCycles,
  formatAmount,
  maskAmounts,
  isLoadingLoans = false,
}: GlobalSearchProps) {
  // Destructured rather than kept as one `search` object: the hook returns element refs beside
  // its render values, so reading them off one `search` object made `react-hooks/refs` treat
  // every `search.results` read as a ref access during render.
  const {
    query,
    updateQuery,
    results,
    groups,
    activeIndex,
    setActiveIndex,
    selectableCount,
    canSearchAllCycles,
    allCyclesIndex,
    trimmedQuery,
    inputRef,
    listRef,
    panelRef,
    handleKeyDown,
    openIndex,
    close,
    optionId,
    indexOfResult,
  } = useGlobalSearch({
    isOpen,
    data,
    includeAmounts: !maskAmounts,
    onClose,
    onOpenResult,
    onSearchAllCycles,
  })

  if (!isOpen) return null

  const hasQuery = trimmedQuery.length > 0
  const isAllCyclesActive = activeIndex === allCyclesIndex

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 p-3 pt-12 backdrop-blur-md sm:pt-20 animate-in fade-in duration-150"
      onClick={close}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onClick={event => event.stopPropagation()}
        // Capped against --app-vvh, not vh: vh does not shrink for the on-screen keyboard, and
        // this panel is opened by typing, so the keyboard is always up on a phone.
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl max-h-[min(80vh,calc(var(--app-vvh,100dvh)-6rem))] animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-3 border-b border-border/50 bg-muted/20 px-4 py-3">
          <Search className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            ref={inputRef}
            type="text"
            role="combobox"
            value={query}
            onChange={event => updateQuery(event.target.value)}
            placeholder="Search transactions, accounts, bills, loans…"
            aria-label="Search your records"
            aria-expanded
            aria-autocomplete="list"
            aria-controls="global-search-results"
            aria-activedescendant={selectableCount > 0 ? optionId(activeIndex) : undefined}
            className="w-full border-0 bg-transparent text-sm font-semibold text-foreground shadow-none outline-hidden placeholder:text-muted-foreground focus-visible:ring-0"
          />
          {hasQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                updateQuery('')
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="size-7 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        <div
          ref={listRef}
          id="global-search-results"
          role="listbox"
          aria-label="Search results"
          className="flex-1 overflow-y-auto overscroll-contain p-2"
        >
          {!hasQuery ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              {isLoadingLoans
                ? 'Loading loan records…'
                : 'Start typing to find a transaction, account, bill, loan, commitment, or reward.'}
            </p>
          ) : (
            <>
              {groups.map(group => (
                <div key={group.kind} className="mb-1 last:mb-0">
                  <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.results.map(result => {
                      const index = indexOfResult(result)
                      return (
                        <SearchResultRow
                          key={result.id}
                          result={result}
                          id={optionId(index)}
                          isActive={index === activeIndex}
                          amountText={typeof result.amount === 'number' ? formatAmount(result.amount) : null}
                          onActivate={() => openIndex(index)}
                          onHover={() => setActiveIndex(index)}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}

              {results.length === 0 && (
                <p className="px-3 pb-1 pt-6 text-center text-xs text-muted-foreground">
                  {isLoadingLoans ? 'Loading loan records…' : <>Nothing in this cycle matches “{trimmedQuery}”.</>}
                </p>
              )}

              {/* The handoff is always offered, found or not: only the loaded cycle was searched,
                  so "no matches" here is never proof the record does not exist. */}
              {canSearchAllCycles && (
                <Button
                  variant="unstyled"
                  id={optionId(allCyclesIndex)}
                  role="option"
                  aria-selected={isAllCyclesActive}
                  data-active={isAllCyclesActive}
                  onClick={() => openIndex(allCyclesIndex)}
                  onMouseMove={() => setActiveIndex(allCyclesIndex)}
                  className={`mt-2 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left cursor-pointer transition-colors duration-100 ${
                    isAllCyclesActive ? 'bg-muted/80 border-border/60 shadow-xs' : 'border-border/40 hover:bg-muted/40'
                  }`}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-muted/40 text-muted-foreground">
                    <Layers className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-foreground">
                      Search every cycle for “{trimmedQuery}”
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      Opens the Ledger across all cycles
                    </span>
                  </span>
                </Button>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/40 bg-muted/15 px-4 py-2 text-[10px] text-muted-foreground select-none">
          <span className="flex items-center gap-3">
            <span><kbd className="font-bold">↑↓</kbd> Move</span>
            <span><kbd className="font-bold">↵</kbd> Open</span>
            <span><kbd className="font-bold">esc</kbd> Close</span>
          </span>
          <span aria-live="polite" aria-atomic="true" className="font-semibold text-foreground/75">
            {isLoadingLoans ? 'Loading loans…' : hasQuery ? `${results.length} found in this cycle` : 'Search'}
          </span>
        </div>
      </div>
    </div>
  )
}
