import React, { useRef, useEffect, useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { FormField } from '../../ui/FormField'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { PerimeterBeam } from '../../ui/PerimeterBeam'
import { AnchoredPopover } from '../../ui/AnchoredPopover'
import { HorizontalRail } from '../../ui/HorizontalRail'
import type { TransactionFormState } from './transactionFormReducer'

export interface TransactionDescriptionFieldProps {
  state: TransactionFormState
  firstInputRef: React.RefObject<HTMLInputElement | null>
  descriptionRef: React.MutableRefObject<string>
  autocompletedDescriptionRef: React.MutableRefObject<string | null>
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

export const TransactionDescriptionField: React.FC<TransactionDescriptionFieldProps> = ({
  state,
  firstInputRef,
  descriptionRef,
  autocompletedDescriptionRef,
  errors,
  onSetField,
  onSelectSuggestion,
  onSuggestNotes,
  onSuggestCategory,
  filteredSuggestions,
  quickSuggestionEntries,
  suggestions,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const descriptionAnchorRef = useRef<HTMLDivElement>(null)

  const handleDescriptionBlur = () => {
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

  useEffect(() => {
    if (selectedSuggestionIndex >= 0 && suggestionsRef.current) {
      const activeEl = suggestionsRef.current.children[selectedSuggestionIndex] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedSuggestionIndex])

  return (
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
        <span className="text-xs font-semibold text-muted-foreground">Description</span>
        {state.transactionType !== 'transfer' && (
          <Button
            variant="tertiary"
            size="sm"
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={onSuggestNotes}
            disabled={suggestions.isSuggestingNote || state.description.trim().length < 2}
            title={state.description.trim().length < 2 ? 'Enter a description first' : 'Suggest better notes'}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/5 px-2 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
          >
            {suggestions.isSuggestingNote ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
            AI
          </Button>
        )}
      </div>

      <FormField label="Transaction description" labelClassName="sr-only" required error={errors.description}>
        <div ref={descriptionAnchorRef} className={`relative rounded-xl ${suggestions.isSuggestingNote ? 'perimeter-beam-host' : ''}`}>
          {suggestions.isSuggestingNote && <PerimeterBeam size={40} />}
          <Input
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
          />
        </div>
      </FormField>

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
            <Button
              variant="tertiary"
              key={s.note}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onSetField('description', s.note)
                descriptionRef.current = s.note
                suggestions.setShowNoteSuggestions(false)
              }}
              className="w-full items-start justify-start text-left px-3.5 py-2.5 text-sm flex flex-col gap-0.5 cursor-pointer transition duration-100 hover:bg-blue-500/10 first:rounded-t-xl last:rounded-b-xl"
            >
              <span className="font-semibold text-foreground">{s.note}</span>
              <span className="text-xs text-muted-foreground">{s.reason}</span>
            </Button>
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
            <Button
              variant="tertiary"
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
                  ? 'bg-blue-500/10 hover:bg-blue-500/10 text-foreground'
                  : 'hover:bg-muted/50 text-foreground'
              }`}
            >
              <span className="truncate">{rendered}</span>
              <span className="inline-block text-xs px-1.5 py-0.5 font-semibold rounded border bg-slate-500/10 text-muted-foreground border-border/30 shrink-0">
                {s.ledgerCategory}{'·'}{s.category}
              </span>
            </Button>
          )
        })}
      </AnchoredPopover>

      {!suggestions.showNoteSuggestions && !state.description.trim() && quickSuggestionEntries.length > 0 && (
        <HorizontalRail label="Quick transaction suggestions" className="gap-1.5 pt-1 pb-0.5">
          {quickSuggestionEntries.map(s => (
            <Button
              variant="tertiary"
              key={s.description}
              type="button"
              onMouseDown={() => {
                autocompletedDescriptionRef.current = s.description.trim()
              }}
              onClick={() => onSelectSuggestion(s)}
              className="shrink-0 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            >
              {s.description}
            </Button>
          ))}
        </HorizontalRail>
      )}
    </div>
  )
}
