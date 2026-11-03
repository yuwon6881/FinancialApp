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
  onSuggestNotes: (options?: { auto?: boolean }) => Promise<void>
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

/** How long the description must sit untouched before the AI cleanup runs by itself. */
const AUTO_CLEANUP_IDLE_MS = 1000

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
  const blurTimeoutRef = useRef<number | undefined>(undefined)
  const autoCleanupTimeoutRef = useRef<number | undefined>(undefined)
  const lastAutoCleanupTextRef = useRef<string | null>(null)
  const isFocusedRef = useRef(false)
  const scheduledTextRef = useRef<string | null>(null)
  const localInputRef = useRef<HTMLInputElement | null>(null)
  const suggestionsPropRef = useRef(suggestions)
  const onSuggestNotesRef = useRef(onSuggestNotes)

  useEffect(() => {
    suggestionsPropRef.current = suggestions
    onSuggestNotesRef.current = onSuggestNotes
  })

  const getInputEl = () => localInputRef.current || (firstInputRef && 'current' in firstInputRef ? firstInputRef.current : null)

  const cancelAutoCleanup = () => {
    window.clearTimeout(autoCleanupTimeoutRef.current)
    autoCleanupTimeoutRef.current = undefined
    scheduledTextRef.current = null
  }

  useEffect(() => {
    const handleWindowBlur = () => {
      isFocusedRef.current = false
      cancelAutoCleanup()
    }
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        isFocusedRef.current = false
        cancelAutoCleanup()
      }
    }
    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearTimeout(blurTimeoutRef.current)
      cancelAutoCleanup()
      window.removeEventListener('blur', handleWindowBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (!state.showAddForm || state.mode === 'edit' || state.transactionType === 'transfer') {
      cancelAutoCleanup()
      return
    }
    if (scheduledTextRef.current !== null && state.description.trim() !== scheduledTextRef.current) {
      cancelAutoCleanup()
    }
  }, [state.description, state.mode, state.transactionType, state.showAddForm])

  // Only typing schedules the cleanup, so a description read from a notification stays untouched
  // until the user edits it. Picking an autocomplete entry or editing a saved transaction never does.
  const scheduleAutoCleanup = (typed: string) => {
    cancelAutoCleanup()
    const text = typed.trim()
    if (
      !state.showAddForm ||
      state.mode === 'edit' ||
      state.transactionType === 'transfer' ||
      text.length < 2 ||
      text === lastAutoCleanupTextRef.current ||
      autocompletedDescriptionRef.current === text
    ) return
    scheduledTextRef.current = text
    autoCleanupTimeoutRef.current = window.setTimeout(() => {
      autoCleanupTimeoutRef.current = undefined
      scheduledTextRef.current = null
      if (!isFocusedRef.current || suggestionsPropRef.current.isSuggestingNote) return
      if (typeof document !== 'undefined') {
        const active = document.activeElement
        const inputEl = getInputEl()
        if (!inputEl || !inputEl.isConnected || active !== inputEl) {
          isFocusedRef.current = false
          return
        }
      }
      lastAutoCleanupTextRef.current = text
      void onSuggestNotesRef.current({ auto: true })
    }, AUTO_CLEANUP_IDLE_MS)
  }

  const handleDescriptionBlur = () => {
    isFocusedRef.current = false
    cancelAutoCleanup()
    window.clearTimeout(blurTimeoutRef.current)
    blurTimeoutRef.current = window.setTimeout(() => {
      setShowSuggestions(false)
      void onSuggestCategory()
    }, 200)
  }

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' || e.key === 'Enter' || e.key === 'Escape' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      cancelAutoCleanup()
    }
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
      if (activeEl && typeof activeEl.scrollIntoView === 'function') {
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
            onClick={() => {
              cancelAutoCleanup()
              void onSuggestNotes()
            }}
            disabled={suggestions.isSuggestingNote || state.description.trim().length < 2}
            title={state.description.trim().length < 2 ? 'Enter a description first' : 'Suggest better notes'}
            className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1 text-caption font-semibold text-accent-ink hover:bg-primary/10 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
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
            ref={node => {
              localInputRef.current = node
              if (firstInputRef) {
                if (typeof firstInputRef === 'function') {
                  (firstInputRef as any)(node)
                } else {
                  (firstInputRef as any).current = node
                }
              }
            }}
            type="text"
            placeholder="e.g. Grocery Store, Paycheck"
            value={state.description}
            onBlur={handleDescriptionBlur}
            onChange={e => {
              const inputEl = getInputEl()
              const isCurrentlyFocused = typeof document !== 'undefined' && inputEl
                ? document.activeElement === inputEl
                : isFocusedRef.current
              if (!isCurrentlyFocused) {
                // Programmatic change, extension, or autofill while not focused: do not schedule cleanup or steal focus
                isFocusedRef.current = false
                cancelAutoCleanup()
                const nextVal = e.target.value
                descriptionRef.current = nextVal
                onSetField('description', nextVal)
                if (autocompletedDescriptionRef.current && autocompletedDescriptionRef.current !== nextVal.trim()) {
                  autocompletedDescriptionRef.current = null
                }
                if (nextVal.trim().length === 0) {
                  lastAutoCleanupTextRef.current = null
                }
                suggestions.setShowNoteSuggestions(false)
                suggestions.setNoteSuggestions([])
                suggestions.setIsSuggestingNote(false)
                setShowSuggestions(false)
                setSelectedSuggestionIndex(-1)
                return
              }
              isFocusedRef.current = true
              const nextVal = e.target.value
              descriptionRef.current = nextVal
              onSetField('description', nextVal)
              if (autocompletedDescriptionRef.current && autocompletedDescriptionRef.current !== nextVal.trim()) {
                autocompletedDescriptionRef.current = null
              }
              if (nextVal.trim().length === 0) {
                lastAutoCleanupTextRef.current = null
              }
              suggestions.setShowNoteSuggestions(false)
              suggestions.setNoteSuggestions([])
              suggestions.setIsSuggestingNote(false)
              setShowSuggestions(true)
              setSelectedSuggestionIndex(-1)
              scheduleAutoCleanup(nextVal)
            }}
            onFocus={() => {
              isFocusedRef.current = true
              if (!suggestions.showNoteSuggestions && state.description.trim().length >= 1) setShowSuggestions(true)
            }}
            onKeyDown={handleDescriptionKeyDown}
            autoComplete="off"
            // One press clears a description read from a notification that is not what the user
            // wants, rather than holding backspace through it.
            onClear={() => {
              cancelAutoCleanup()
              lastAutoCleanupTextRef.current = null
              descriptionRef.current = ''
              autocompletedDescriptionRef.current = null
              onSetField('description', '')
              suggestions.setShowNoteSuggestions(false)
              suggestions.setNoteSuggestions([])
              setShowSuggestions(false)
              setSelectedSuggestionIndex(-1)
            }}
            clearLabel="Clear description"
          />
        </div>
      </FormField>

      <AnchoredPopover
        open={suggestions.showNoteSuggestions}
        anchorRef={descriptionAnchorRef}
        onDismiss={() => suggestions.setShowNoteSuggestions(false)}
        matchAnchorWidth
        side="bottom"
        className="z-[190] overflow-y-auto overscroll-contain bg-card border border-primary/25 rounded-xl shadow-(--app-shadow-overlay) animate-in fade-in slide-in-from-top-2 duration-150"
      >
        {suggestions.isSuggestingNote ? (
          <div className="flex items-center gap-2 px-3.5 py-3 text-xs font-semibold text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin text-accent-ink" />
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
                cancelAutoCleanup()
                autocompletedDescriptionRef.current = s.note.trim()
                onSetField('description', s.note)
                descriptionRef.current = s.note
                suggestions.setShowNoteSuggestions(false)
              }}
              className="w-full items-start justify-start text-left px-3.5 py-2.5 text-sm flex flex-col gap-0.5 cursor-pointer transition duration-100 hover:bg-primary/10 first:rounded-t-xl last:rounded-b-xl"
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
        onDismiss={() => setShowSuggestions(false)}
        matchAnchorWidth
        side="bottom"
        className="z-[210] overflow-y-auto overscroll-contain bg-card border border-border/80 rounded-xl shadow-(--app-shadow-overlay) animate-in fade-in slide-in-from-top-2 duration-150"
      >
        {filteredSuggestions.map((s, idx) => {
          const query = state.description.toLowerCase().trim()
          const matchIdx = s.description.toLowerCase().indexOf(query)
          let rendered: React.ReactNode = s.description
          if (matchIdx >= 0 && query.length > 0) {
            const before = s.description.slice(0, matchIdx)
            const match = s.description.slice(matchIdx, matchIdx + query.length)
            const after = s.description.slice(matchIdx + query.length)
            rendered = <>{before}<span className="text-accent-ink font-semibold">{match}</span>{after}</>
          }
          return (
            <Button
              variant="tertiary"
              key={s.description}
              data-suggestion
              type="button"
              onMouseDown={() => {
                cancelAutoCleanup()
                autocompletedDescriptionRef.current = s.description.trim()
              }}
              onClick={() => {
                cancelAutoCleanup()
                onSelectSuggestion(s)
                setShowSuggestions(false)
              }}
              className={`w-full text-left px-3.5 py-2 text-sm flex items-center justify-between gap-2 cursor-pointer transition duration-100 first:rounded-t-xl last:rounded-b-xl ${
                idx === selectedSuggestionIndex
                  ? 'bg-primary/10 hover:bg-primary/10 text-foreground'
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
                cancelAutoCleanup()
                autocompletedDescriptionRef.current = s.description.trim()
              }}
              onClick={() => {
                cancelAutoCleanup()
                onSelectSuggestion(s)
              }}
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
