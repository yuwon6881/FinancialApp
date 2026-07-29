import React, { useRef, useEffect } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { PerimeterBeam } from '../../ui/PerimeterBeam'
import { CustomSelect } from '../../ui/CustomSelect'
import { SearchableSelect } from '../../ui/SearchableSelect'
import { DatePicker } from '../../ui/DatePicker'
import { AnchoredPopover } from '../../ui/AnchoredPopover'
import { SmartAmountInput } from '../../ui/SmartAmountInput'
import { maskCurrencyInput } from '../../../lib/utils'
import type { TransactionFormState, TransferBucket, SelectableLedgerCategory } from './transactionFormReducer'

interface TransactionFormFieldsProps {
  state: TransactionFormState
  firstInputRef: React.RefObject<HTMLInputElement | null>
  descriptionRef: React.MutableRefObject<string>
  autocompletedDescriptionRef: React.MutableRefObject<string | null>
  currency: string
  categories: any[]
  errors: Record<string, string>
  onSetField: (field: keyof TransactionFormState, value: any) => void
  onSelectSuggestion: (s: any) => void
  onSuggestNotes: () => Promise<void>
  onSuggestCategory: () => Promise<void>
  filteredSuggestions: any[]
  quickSuggestionEntries: any[]
  suggestions: {
    categorySuggestions: any[]
    isSuggestingCategory: boolean
    categorySuggestionUnavailable: boolean
    isSuggestingNote: boolean
    noteSuggestions: any[]
    showNoteSuggestions: boolean
    noteSuggestionUnavailable: boolean
    setShowNoteSuggestions: (v: boolean) => void
    setNoteSuggestions: (v: any[]) => void
    setIsSuggestingNote: (v: boolean) => void
  }
}

export function TransactionFormFields({
  state,
  firstInputRef,
  descriptionRef,
  autocompletedDescriptionRef,
  currency,
  categories,
  errors,
  onSetField,
  onSelectSuggestion,
  onSuggestNotes,
  onSuggestCategory,
  filteredSuggestions,
  quickSuggestionEntries,
  suggestions,
}: TransactionFormFieldsProps) {
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = React.useState(-1)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const descriptionAnchorRef = useRef<HTMLDivElement>(null)

  const handleDescriptionBlur = () => {
    // Keep suggestions open if clicking inside them
    window.setTimeout(() => {
      setShowSuggestions(false)
      void onSuggestCategory()
    }, 200)
  }

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredSuggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => (prev + 1) % filteredSuggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length)
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault()
      const selected = filteredSuggestions[selectedSuggestionIndex]
      autocompletedDescriptionRef.current = selected.description.trim()
      onSelectSuggestion(selected)
      setShowSuggestions(false)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const handleQuickSuggestionsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY
      e.preventDefault()
    }
  }

  // Scroll active suggestion into view inside suggestion list container
  useEffect(() => {
    if (selectedSuggestionIndex >= 0 && suggestionsRef.current) {
      const activeEl = suggestionsRef.current.children[selectedSuggestionIndex] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedSuggestionIndex])

  const getCurrencySymbol = (code: string) => {
    if (code === 'USD') return '$'
    if (code === 'EUR') return '€'
    if (code === 'GBP') return '£'
    return code + ' '
  }

  const categorySelectOptions = React.useMemo(() => {
    const categoryByName = new Map(categories.map(cat => [cat.name.toLowerCase(), cat.name]))
    const suggestedNames = new Set<string>()
    const suggestedOptions = suggestions.categorySuggestions.map((suggestion: any) => {
      const canonicalName = categoryByName.get(String(suggestion.category).toLowerCase())
      if (!canonicalName || suggestedNames.has(canonicalName.toLowerCase())) return null
      suggestedNames.add(canonicalName.toLowerCase())
      const confidence = Number.isFinite(suggestion.confidence)
        ? `Suggested ${Math.round(Math.max(0, Math.min(1, suggestion.confidence)) * 100)}%`
        : 'Suggested'
      return { value: canonicalName, label: canonicalName, badge: confidence }
    }).filter((option): option is { value: string; label: string; badge: string } => option !== null)
    return [
      ...suggestedOptions,
      ...categories
      .filter(cat => !cat.isPendingDelete)
      .filter(cat => !suggestedNames.has(cat.name.toLowerCase()))
      .map(cat => {
        return {
          value: cat.name,
          label: cat.name,
        }
      }),
    ]
  }, [categories, suggestions.categorySuggestions])

  return (
    <>
      <div
        className="space-y-1 relative description-autocomplete sm:col-span-2"
        onKeyDown={event => {
          if (event.key === 'Escape' && (showSuggestions || suggestions.showNoteSuggestions)) {
            event.preventDefault()
            event.stopPropagation()
            setShowSuggestions(false)
            suggestions.setShowNoteSuggestions(false)
          }
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-muted-foreground">Description</label>
          {state.transactionType !== 'transfer' && (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={onSuggestNotes}
              disabled={suggestions.isSuggestingNote || state.description.trim().length < 2}
              title={state.description.trim().length < 2 ? 'Enter a description first' : 'Suggest better notes'}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/5 px-2 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
            >
              {suggestions.isSuggestingNote ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              AI
            </button>
          )}
        </div>
        {/* rounded-xl matches the input inside: the beam inherits the host's radius,
            and a square host would corner the trace off the field. */}
        <div ref={descriptionAnchorRef} className={`relative rounded-xl ${suggestions.isSuggestingNote ? 'perimeter-beam-host' : ''}`}>
          {suggestions.isSuggestingNote && <PerimeterBeam size={40} />}
          <input
            ref={firstInputRef}
            type="text"
            placeholder="e.g. Grocery Store, Paycheck"
            value={state.description}
            onBlur={handleDescriptionBlur}
            onChange={e => {
              const nextVal = e.target.value
              descriptionRef.current = nextVal
              onSetField('description', nextVal)
              if (autocompletedDescriptionRef.current && autocompletedDescriptionRef.current !== nextVal.trim()) {
                autocompletedDescriptionRef.current = null
              }
              suggestions.setShowNoteSuggestions(false)
              suggestions.setNoteSuggestions([])
              suggestions.setIsSuggestingNote(false)
              setShowSuggestions(true)
              setSelectedSuggestionIndex(-1)
            }}
            onFocus={() => {
              if (!suggestions.showNoteSuggestions && state.description.trim().length >= 1) setShowSuggestions(true)
            }}
            onKeyDown={handleDescriptionKeyDown}
            autoComplete="off"
            className={`w-full px-3.5 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
              errors.description
                ? 'border-destructive focus:ring-destructive'
                : 'border-border focus:ring-ring'
            }`}
          />
        </div>
        {errors.description && (
          <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
            {errors.description}
          </p>
        )}

        <AnchoredPopover
          open={suggestions.showNoteSuggestions}
          anchorRef={descriptionAnchorRef}
          matchAnchorWidth
          side="bottom"
          className="z-[190] overflow-y-auto overscroll-contain bg-card border border-blue-500/25 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2 duration-150"
        >
            {suggestions.isSuggestingNote ? (
              <div className="flex items-center gap-2 px-3.5 py-3 text-xs font-semibold text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-blue-500" />
                Suggesting cleaner notes...
              </div>
            ) : suggestions.noteSuggestions.length > 0 ? (
              suggestions.noteSuggestions.map((s: any) => (
                <button
                  key={s.note}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    onSetField('description', s.note)
                    descriptionRef.current = s.note
                    suggestions.setShowNoteSuggestions(false)
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-sm flex flex-col gap-0.5 cursor-pointer transition duration-100 hover:bg-blue-500/10 first:rounded-t-xl last:rounded-b-xl"
                >
                  <span className="font-semibold text-foreground">{s.note}</span>
                  <span className="text-[10px] text-muted-foreground">{s.reason}</span>
                </button>
              ))
            ) : suggestions.noteSuggestionUnavailable ? (
              <div className="px-3.5 py-3 text-xs font-semibold text-amber-600 dark:text-amber-500">
                AI suggestions are unavailable right now. Please try again.
              </div>
            ) : (
              <div className="px-3.5 py-3 text-xs font-semibold text-muted-foreground">
                No better note found for this description.
              </div>
            )}
        </AnchoredPopover>

        <AnchoredPopover
            ref={suggestionsRef}
            open={showSuggestions && !suggestions.showNoteSuggestions && filteredSuggestions.length > 0}
            anchorRef={descriptionAnchorRef}
            matchAnchorWidth
            side="bottom"
            className="z-[210] overflow-y-auto overscroll-contain bg-card border border-border/80 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2 duration-150"
        >
            {filteredSuggestions.map((s, idx) => {
              const query = state.description.toLowerCase().trim()
              const matchIdx = s.description.toLowerCase().indexOf(query)
              let rendered: React.ReactNode = s.description
              if (matchIdx >= 0 && query.length > 0) {
                const before = s.description.slice(0, matchIdx)
                const match = s.description.slice(matchIdx, matchIdx + query.length)
                const after = s.description.slice(matchIdx + query.length)
                rendered = <>{before}<span className="text-blue-500 font-bold">{match}</span>{after}</>
              }
              return (
                <button
                  key={s.description}
                  data-suggestion
                  type="button"
                  onMouseDown={() => {
                    autocompletedDescriptionRef.current = s.description.trim()
                  }}
                  onClick={() => {
                    onSelectSuggestion(s)
                    setShowSuggestions(false)
                  }}
                  className={`w-full text-left px-3.5 py-2 text-sm flex items-center justify-between gap-2 cursor-pointer transition duration-100 first:rounded-t-xl last:rounded-b-xl ${
                    idx === selectedSuggestionIndex
                      ? 'bg-blue-500/10 text-foreground'
                      : 'hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <span className="truncate">{rendered}</span>
                  <span className="inline-block text-[9px] px-1.5 py-0.5 font-semibold rounded border bg-slate-500/10 text-muted-foreground border-border/30 shrink-0">
                    {s.ledgerCategory}{'·'}{s.category}
                  </span>
                </button>
              )
            })}
        </AnchoredPopover>

        {!suggestions.showNoteSuggestions && !state.description.trim() && quickSuggestionEntries.length > 0 && (
          <div
            onWheel={handleQuickSuggestionsWheel}
            className="no-scrollbar flex gap-1.5 overflow-x-auto overscroll-x-contain pt-1 pb-0.5"
          >
            {quickSuggestionEntries.map(s => (
              <button
                key={s.description}
                type="button"
                onMouseDown={() => {
                  autocompletedDescriptionRef.current = s.description.trim()
                }}
                onClick={() => onSelectSuggestion(s)}
                className="shrink-0 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
              >
                {s.description}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1 sm:col-span-2">
        <label className="flex items-center h-5 text-xs font-semibold text-muted-foreground">Amount ({getCurrencySymbol(currency)})</label>
        <div className="relative flex items-center">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 text-sm font-semibold text-muted-foreground pointer-events-none select-none leading-none">
            {getCurrencySymbol(currency)}
          </span>
          <SmartAmountInput
            type="text"
            placeholder="0.00"
            value={state.amount}
            onChange={e => {
              onSetField('amount', maskCurrencyInput(e.target.value, state.amount))
            }}
            className={`w-full h-10 pr-3.5 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
              getCurrencySymbol(currency).length > 2 ? 'pl-12' : getCurrencySymbol(currency).length > 1 ? 'pl-10' : 'pl-8'
            } ${
              errors.amount
                ? 'border-destructive focus:ring-destructive'
                : 'border-border focus:ring-ring'
            }`}
          />
        </div>
        {errors.amount && (
          <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
            {errors.amount}
          </p>
        )}
      </div>

      {state.transactionType === 'transfer' ? (
        <>
          <div className="space-y-1">
            <label className="flex items-center h-5 text-xs font-semibold text-muted-foreground">Source Category (From)</label>
            <CustomSelect
              ariaLabel="Transfer source category"
              value={state.transferSource}
              onChange={val => onSetField('transferSource', val as TransferBucket)}
              options={[
                { value: 'Essentials', label: 'Essentials' },
                { value: 'Growth', label: 'Growth' },
                { value: 'Stability', label: 'Stability' },
                { value: 'Rewards', label: 'Rewards' }
              ]}
              className="w-full"
            />
          </div>

          <div className="space-y-1">
            <label className="flex items-center h-5 text-xs font-semibold text-muted-foreground">Target Category (To)</label>
            <CustomSelect
              ariaLabel="Transfer target category"
              value={state.transferTarget}
              onChange={val => onSetField('transferTarget', val as TransferBucket)}
              options={[
                { value: 'Essentials', label: 'Essentials' },
                { value: 'Growth', label: 'Growth' },
                { value: 'Stability', label: 'Stability' },
                { value: 'Rewards', label: 'Rewards' }
              ].filter(option => option.value !== state.transferSource)}
              className="w-full"
            />
            {errors.transferTarget && (
              <p className="text-[11px] text-destructive font-medium mt-1">{errors.transferTarget}</p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1 sm:col-span-2">
            <div className="flex items-center justify-between gap-2 h-5">
              <label className="text-xs font-semibold text-muted-foreground">Category</label>
              {suggestions.isSuggestingCategory ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-500 whitespace-nowrap shrink-0">
                  <Loader2 className="size-3 animate-spin" /> Suggesting
                </span>
              ) : suggestions.categorySuggestionUnavailable ? (
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-500 whitespace-nowrap shrink-0">
                  AI unavailable
                </span>
              ) : null}
            </div>
            <SearchableSelect
              value={state.category}
              onChange={val => onSetField('category', val)}
              options={categorySelectOptions}
              className="w-full"
            />
          </div>

          <div className="space-y-1">
            <label className="flex items-center h-5 text-xs font-semibold text-muted-foreground">Ledger Category</label>
            <CustomSelect
              ariaLabel="Ledger category"
              value={state.ledgerCategory}
              onChange={val => onSetField('ledgerCategory', val as SelectableLedgerCategory)}
              options={[
                ...(state.transactionType === 'inflow' ? [{ value: 'Income', label: 'Income (Allocate Split)' }] : []),
                { value: 'Essentials', label: 'Essentials' },
                { value: 'Growth', label: 'Growth' },
                { value: 'Stability', label: 'Stability' },
                { value: 'Rewards', label: 'Rewards' }
              ]}
              className="w-full"
            />
          </div>
        </>
      )}

      <div className="space-y-1">
        <label className="flex items-center h-5 text-xs font-semibold text-muted-foreground">Posting Date</label>
        <DatePicker
          value={state.date}
          onChange={value => {
            onSetField('date', value)
          }}
          error={!!errors.date}
          className="w-full"
        />
        {errors.date && (
          <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
            {errors.date}
          </p>
        )}
      </div>
    </>
  )
}
