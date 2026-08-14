import { Input } from '../../ui/Input'
import React, { useRef, useEffect } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { PerimeterBeam } from '../../ui/PerimeterBeam'
import { CustomSelect } from '../../ui/CustomSelect'
import { DatePicker } from '../../ui/DatePicker'
import { AnchoredPopover } from '../../ui/AnchoredPopover'
import { SmartAmountInput } from '../../ui/SmartAmountInput'
import { maskCurrencyInput } from '../../../lib/utils'
import type { TransactionFormState, TransferBucket, SelectableLedgerCategory } from './transactionFormReducer'
import type { LedgerAccount } from '../../../types'
import { FormField } from '../../ui/FormField'
import { Button } from '../../ui/Button'
import { InfoHint } from '../../ui/InfoHint'
import { HorizontalRail } from '../../ui/HorizontalRail'
import { StabilityTopUpOffer } from './StabilityTopUpOffer'
import type { RecoveryBucketState, RecoveryOffer } from '../../../lib/stabilityRecovery'
import { isStabilityReloadFormDrawdown } from '../../../lib/stabilityRecovery'
import { isSelectableTransactionCategory } from '../../../lib/categoryFlow'

interface TransactionFormFieldsProps {
  state: TransactionFormState
  firstInputRef: React.RefObject<HTMLInputElement | null>
  descriptionRef: React.MutableRefObject<string>
  autocompletedDescriptionRef: React.MutableRefObject<string | null>
  currency: string
  categories: any[]
  accounts?: LedgerAccount[]
  errors: Record<string, string>
  onSetField: (field: keyof TransactionFormState, value: any) => void
  onSetSplitAccountId?: (bucket: TransferBucket, accountId: string) => void
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
  /** Null unless this is income with an amount and the emergency fund is genuinely short. */
  topUpOffer?: RecoveryOffer | null
  topUpBuckets?: RecoveryBucketState[]
  stabilityTopUpError?: string
  hideSensitive?: boolean
  stabilityAlloc?: number
}

export function TransactionFormFields({
  state,
  firstInputRef,
  descriptionRef,
  autocompletedDescriptionRef,
  currency,
  categories,
  accounts = [],
  errors,
  onSetField,
  onSetSplitAccountId,
  onSelectSuggestion,
  onSuggestNotes,
  onSuggestCategory,
  filteredSuggestions,
  quickSuggestionEntries,
  suggestions,
  topUpOffer = null,
  topUpBuckets = [],
  stabilityTopUpError,
  hideSensitive = false,
  stabilityAlloc = 0,
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
    const activeTxType = state.transactionType
    const availableCategories = categories.filter(cat => {
      if (activeTxType === 'inflow' || activeTxType === 'outflow') {
        return isSelectableTransactionCategory(cat, activeTxType)
      }
      return isSelectableTransactionCategory(cat)
    })
    const categoryByName = new Map(availableCategories.map(cat => [cat.name.toLowerCase(), cat.name]))
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
      ...availableCategories
      .filter(cat => !suggestedNames.has(cat.name.toLowerCase()))
      .map(cat => {
        return {
          value: cat.name,
          label: cat.name,
        }
      }),
    ]
  }, [categories, suggestions.categorySuggestions, state.transactionType])

  const isAccountMove = state.ledgerCategory === 'AccountMove'
  const accountMoveBucket = accounts.find(account => account.id === state.accountId)?.bucket
    ?? accounts.find(account => account.id === state.counterAccountId)?.bucket
  const accountMoveOptions = React.useMemo(() => accounts
    .filter(account => (!accountMoveBucket || account.bucket === accountMoveBucket)
      && (!account.isArchived || account.id === state.accountId || account.id === state.counterAccountId))
    .map(account => ({
      value: account.id,
      label: `${account.name} (${account.bucket})${account.isArchived ? ' (Closed)' : ''}`,
      disabled: account.isArchived,
    })), [accounts, accountMoveBucket, state.accountId, state.counterAccountId])
  const accountBucket = state.transactionType === 'transfer'
    ? state.transferSource
    : (['Essentials', 'Growth', 'Stability', 'Rewards'].includes(state.ledgerCategory) ? state.ledgerCategory : null)
  const isTransfer = String(state.transactionType) === 'transfer'
  const accountTrackingEnabled = accounts.length > 0
  const accountOptions = React.useMemo(() => {
    if (!accountBucket) return []
    const bucketAccounts = accounts.filter(account =>
      account.bucket === accountBucket && (!account.isArchived || account.id === state.accountId),
    )
    const defaultAccount = bucketAccounts.find(account => account.isDefault && !account.isArchived)
    return [
      { value: defaultAccount?.id ?? '', label: defaultAccount ? `Use ${defaultAccount.name} (default)` : `Choose ${accountBucket} account` },
      ...bucketAccounts.filter(account => account.id !== defaultAccount?.id).map(account => ({
        value: account.id,
        label: `${account.name}${account.isArchived ? ' (Closed)' : ''}${account.isDefault ? ' · Default' : ''}`,
        disabled: account.isArchived,
      })),
    ]
  }, [accountBucket, accounts, state.accountId])
  const transferTargetOptions = React.useMemo(() => {
    const bucketAccounts = accounts.filter(account =>
      account.bucket === state.transferTarget && (!account.isArchived || account.id === state.counterAccountId),
    )
    const defaultAccount = bucketAccounts.find(account => account.isDefault && !account.isArchived)
    return [
      { value: defaultAccount?.id ?? '', label: defaultAccount ? `Use ${defaultAccount.name} (default)` : `Choose ${state.transferTarget} account` },
      ...bucketAccounts.filter(account => account.id !== defaultAccount?.id).map(account => ({
        value: account.id,
        label: `${account.name}${account.isArchived ? ' (Closed)' : ''}${account.isDefault ? ' · Default' : ''}`,
        disabled: account.isArchived,
      })),
    ]
  }, [accounts, state.counterAccountId, state.transferTarget])

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
          <span className="text-xs font-semibold text-muted-foreground">Description</span>
          {state.transactionType !== 'transfer' && (
            <Button
              variant="ghost"
              size="xs"
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={onSuggestNotes}
              disabled={suggestions.isSuggestingNote || state.description.trim().length < 2}
              title={state.description.trim().length < 2 ? 'Enter a description first' : 'Suggest better notes'}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/5 px-2 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
            >
              {suggestions.isSuggestingNote ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              AI
            </Button>
          )}
        </div>
        {/* rounded-xl matches the input inside: the beam inherits the host's radius,
            and a square host would corner the trace off the field. */}
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
          <HorizontalRail label="Quick transaction suggestions" className="gap-1.5 pt-1 pb-0.5">
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
          </HorizontalRail>
        )}
      </div>

      <FormField
        className="sm:col-span-2"
        label={`Amount (${getCurrencySymbol(currency)})`}
        required
        error={errors.amount}
      >
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
            className={`w-full h-10 pr-3.5 ${
              getCurrencySymbol(currency).length > 2 ? 'pl-12' : getCurrencySymbol(currency).length > 1 ? 'pl-10' : 'pl-8'
            }`}
          />
        </div>
      </FormField>

      {isAccountMove ? (
        <>
          <FormField
            label="From account"
            required
            error={errors.accountId}
          >
            <CustomSelect
              ariaLabel="Source account"
              value={state.accountId ?? ''}
              onChange={value => onSetField('accountId', value || null)}
              options={accountMoveOptions.map(option => ({
                ...option,
                disabled: option.disabled || option.value === state.counterAccountId,
              }))}
              className="w-full"
            />
          </FormField>

          <FormField
            label="To account"
            required
            error={errors.counterAccountId}
          >
            <CustomSelect
              ariaLabel="Destination account"
              value={state.counterAccountId ?? ''}
              onChange={value => onSetField('counterAccountId', value || null)}
              options={accountMoveOptions.map(option => ({
                ...option,
                disabled: option.disabled || option.value === state.accountId,
              }))}
              className="w-full"
            />
          </FormField>

          <FormField label="Posting date" className="sm:col-span-2" required error={errors.date}>
            <DatePicker
              value={state.date}
              onChange={value => {
                onSetField('date', value)
              }}
              className="w-full"
            />
          </FormField>
        </>
      ) : state.transactionType === 'transfer' ? (
        <>
          <FormField label="Source category (from)">
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
          </FormField>

          <FormField label="Target category (to)" required error={errors.transferTarget}>
            <CustomSelect
              ariaLabel="Transfer target category"
              value={state.transferTarget}
              onChange={val => onSetField('transferTarget', val as TransferBucket)}
              options={[
                { value: 'Essentials', label: 'Essentials' },
                { value: 'Growth', label: 'Growth' },
                { value: 'Stability', label: 'Stability' },
                { value: 'Rewards', label: 'Rewards' }
              ]}
              className="w-full"
            />
          </FormField>

          {accountTrackingEnabled && (
            <FormField
              className="sm:col-span-2"
              label="Destination account"
              required
              error={errors.counterAccountId}
            >
              <CustomSelect
                ariaLabel="Transfer destination account"
                value={state.counterAccountId ?? ''}
                onChange={value => onSetField('counterAccountId', value || null)}
                options={transferTargetOptions}
                className="w-full"
              />
            </FormField>
          )}

          <FormField label="Posting date" className="sm:col-span-2" required error={errors.date}>
            <DatePicker
              value={state.date}
              onChange={value => {
                onSetField('date', value)
              }}
              className="w-full"
            />
          </FormField>
        </>
      ) : (
        <>
          <FormField
            className="relative sm:col-span-2"
            required
            error={errors.category}
            label="Category"
          >
            {suggestions.isSuggestingCategory ? (
                <span className="absolute right-0 top-0 inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold text-blue-500">
                  <Loader2 className="size-3 animate-spin" /> Suggesting
                </span>
              ) : suggestions.categorySuggestionUnavailable ? (
                <span className="absolute right-0 top-0 whitespace-nowrap text-[10px] font-semibold text-amber-600 dark:text-amber-500">
                  AI unavailable
                </span>
              ) : null}
            <CustomSelect
              ariaLabel="Category"
              value={state.category}
              onChange={val => onSetField('category', val)}
              options={categorySelectOptions}
              className="w-full"
            />
          </FormField>

          <FormField label="Ledger category">
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
          </FormField>

          {accountTrackingEnabled && state.ledgerCategory === 'Income' && (
            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-3.5 sm:col-span-2">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground">Receiving accounts per bucket</p>
                <p className="text-[11px] text-muted-foreground">
                  Choose which account receives each bucket&apos;s share. Defaults to each bucket&apos;s primary account.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {(['Essentials', 'Growth', 'Stability', 'Rewards'] as const).map(bucket => {
                  const bucketAccounts = accounts.filter(account => account.bucket === bucket && !account.isArchived)
                  const defaultAccount = bucketAccounts.find(account => account.isDefault) ?? bucketAccounts[0]
                  const currentSelectedId = state.splitAccountIds?.[bucket] || defaultAccount?.id || ''
                  const options = bucketAccounts.length > 0
                    ? bucketAccounts.map(account => ({
                        value: account.id,
                        label: `${account.name}${account.isDefault ? ' (Default)' : ''}`,
                      }))
                    : [{ value: '', label: `No open accounts in ${bucket}`, disabled: true }]

                  return (
                    <FormField key={bucket} label={`${bucket} account`}>
                      <CustomSelect
                        ariaLabel={`${bucket} receiving account`}
                        value={currentSelectedId}
                        onChange={value => onSetSplitAccountId?.(bucket, value)}
                        options={options}
                        className="w-full"
                      />
                    </FormField>
                  )
                })}
              </div>
            </div>
          )}

          {accountTrackingEnabled && accountBucket && (
            <FormField
              label={isTransfer ? 'Source account' : 'Account'}
              required
              error={errors.accountId}
            >
              <CustomSelect
                ariaLabel={isTransfer ? 'Source account' : 'Account'}
                value={state.accountId ?? ''}
                onChange={value => onSetField('accountId', value || null)}
                options={accountOptions}
                className="w-full"
              />
            </FormField>
          )}

          <FormField label="Posting date" required error={errors.date}>
            <DatePicker
              value={state.date}
              onChange={value => {
                onSetField('date', value)
              }}
              className="w-full"
            />
          </FormField>

          <StabilityTopUpOffer
            offer={topUpOffer}
            accepted={state.stabilityTopUpAccepted}
            onToggle={value => onSetField('stabilityTopUpAccepted', value)}
            amount={state.stabilityTopUpAmount}
            onAmountChange={value => onSetField('stabilityTopUpAmount', value)}
            buckets={topUpBuckets}
            currency={currency}
            hideSensitive={hideSensitive}
            stabilityAlloc={stabilityAlloc}
            error={errors.stabilityTopUpAmount || stabilityTopUpError}
          />
        </>
      )}

      {isStabilityReloadFormDrawdown(state) && (
        // A div rather than a fieldset/legend: the legend sits in the border line and the box's own
        // top padding then starts below it, so the card opened with a visibly deeper gap than its
        // other three sides.
        <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 sm:col-span-2">
          <p id="stability-reload-intent-label" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            Money out of your emergency fund
            <InfoHint
              label="Emergency-fund putting-back choice"
              text="Only I'll put this back keeps the Today reminder alive. Choose spent for good when this money will not return to the fund."
            />
          </p>
          <div
            className="grid gap-2 sm:grid-cols-2"
            role="radiogroup"
            aria-labelledby="stability-reload-intent-label"
            aria-describedby={errors.stabilityReloadIntent ? 'stability-reload-intent-error' : undefined}
          >
            {([
              ['Required', "I'll put this back"],
              ['NotRequired', "This one's spent for good"],
            ] as const).map(([value, label]) => {
              const selected = state.stabilityReloadIntent === value
              return (
                // Buttons rather than <input type="radio">: styling a native radio's background and
                // border makes Chrome drop native rendering, which painted a filled rectangle over
                // the dot once selected. This is the same role="radio" idiom as TransactionTypeFields.
                <Button
                  key={value}
                  variant="unstyled"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSetField('stabilityReloadIntent', value)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition ${
                    selected
                      ? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      : 'border-border/60 bg-card/60 text-foreground hover:bg-muted/40'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                      selected ? 'border-amber-500' : 'border-border'
                    }`}
                  >
                    {selected && <span className="size-2 rounded-full bg-amber-500" />}
                  </span>
                  {label}
                </Button>
              )
            })}
          </div>
          {errors.stabilityReloadIntent && (
            <p id="stability-reload-intent-error" className="text-xs text-destructive">
              {errors.stabilityReloadIntent}
            </p>
          )}
        </div>
      )}
    </>
  )
}
