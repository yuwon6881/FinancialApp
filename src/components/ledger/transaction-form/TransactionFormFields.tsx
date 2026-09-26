import React from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { CustomSelect } from '../../ui/CustomSelect'
import { DatePicker } from '../../ui/DatePicker'
import { SmartAmountInput } from '../../ui/SmartAmountInput'
import { maskCurrencyInput, formatCurrencyVal } from '../../../lib/utils'
import type { TransactionFormState, TransferBucket, SelectableLedgerCategory } from './transactionFormReducer'
import type { LedgerAccount } from '../../../types'
import { FormField } from '../../ui/FormField'
import { StabilityTopUpOffer } from './StabilityTopUpOffer'
import type { RecoveryBucketState, RecoveryOffer } from '../../../lib/stabilityRecovery'
import { isStabilityReloadFormDrawdown } from '../../../lib/stabilityRecovery'
import { isSelectableTransactionCategory } from '../../../lib/categoryFlow'
import type { BucketOutflowWarning } from '../../../lib/transactionBucketWarnings'
import { AlertBanner } from '../../ui/AlertBanner'
import { getTransactionCyclePlacement, isTransactionOutsideCycle } from '../../../lib/transactionCyclePlacement'
import { TransactionDescriptionField } from './TransactionDescriptionField'
import { AccountTransferFields } from './AccountTransferFields'
import { IncomeSplitAccountsCard } from './IncomeSplitAccountsCard'
import { StabilityReloadIntentCard } from './StabilityReloadIntentCard'

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
  onSwapTransfer?: () => void
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
  bucketOutflowWarning?: BucketOutflowWarning | null
  hideSensitive?: boolean
  stabilityAlloc?: number
  selectedMonth?: string
  selectedYear?: number
  cycleDay?: number
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
  onSwapTransfer,
  onSelectSuggestion,
  onSuggestNotes,
  onSuggestCategory,
  filteredSuggestions,
  quickSuggestionEntries,
  suggestions,
  topUpOffer = null,
  topUpBuckets = [],
  stabilityTopUpError,
  bucketOutflowWarning = null,
  hideSensitive = false,
  stabilityAlloc = 0,
  selectedMonth,
  selectedYear,
  cycleDay = 28,
}: TransactionFormFieldsProps) {
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

  const accountOptions = React.useMemo(() => {
    if (!accountBucket) return []
    const bucketAccounts = accounts.filter(account =>
      account.bucket === accountBucket && (!account.isArchived || account.id === state.accountId),
    )
    return [
      { value: '', label: `Choose ${accountBucket} account`, disabled: false },
      ...bucketAccounts.map(account => ({
        value: account.id,
        label: `${account.name}${account.isArchived ? ' (Closed)' : ''}`,
        disabled: account.isArchived,
      })),
    ]
  }, [accountBucket, accounts, state.accountId])

  const transferTargetOptions = React.useMemo(() => {
    const bucketAccounts = accounts.filter(account =>
      account.bucket === state.transferTarget && (!account.isArchived || account.id === state.counterAccountId),
    )
    return [
      { value: '', label: `Choose ${state.transferTarget} account`, disabled: false },
      ...bucketAccounts.map(account => ({
        value: account.id,
        label: `${account.name}${account.isArchived ? ' (Closed)' : ''}`,
        disabled: account.isArchived,
      })),
    ]
  }, [accounts, state.counterAccountId, state.transferTarget])

  const outsideSelectedCycle = isTransactionOutsideCycle(state.date, selectedMonth, selectedYear, cycleDay)
  const transactionCycle = outsideSelectedCycle ? getTransactionCyclePlacement(state.date, cycleDay) : null

  return (
    <>
      <TransactionDescriptionField
        state={state}
        firstInputRef={firstInputRef}
        descriptionRef={descriptionRef}
        autocompletedDescriptionRef={autocompletedDescriptionRef}
        errors={errors}
        onSetField={onSetField}
        onSelectSuggestion={onSelectSuggestion}
        onSuggestNotes={onSuggestNotes}
        onSuggestCategory={onSuggestCategory}
        filteredSuggestions={filteredSuggestions}
        quickSuggestionEntries={quickSuggestionEntries}
        suggestions={suggestions}
      />

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

      {isAccountMove || state.transactionType === 'transfer' ? (
        <AccountTransferFields
          state={state}
          isAccountMove={isAccountMove}
          errors={errors}
          accountMoveOptions={accountMoveOptions}
          accountOptions={accountOptions}
          transferTargetOptions={transferTargetOptions}
          onSetField={onSetField}
          onSwapTransfer={onSwapTransfer}
        />
      ) : (
        <>
          <FormField
            className="relative sm:col-span-2"
            required
            error={errors.category}
            label="Category"
          >
            {suggestions.isSuggestingCategory ? (
                <span className="absolute right-0 top-0 inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-blue-500">
                  <Loader2 className="size-3 animate-spin" /> Suggesting
                </span>
              ) : suggestions.categorySuggestionUnavailable ? (
                <span className="absolute right-0 top-0 whitespace-nowrap text-xs font-semibold text-amber-600 dark:text-amber-500">
                  AI unavailable
                </span>
              ) : null}
            <CustomSelect
              ariaLabel="Category"
              value={state.category}
              placeholder="Select a category"
              onChange={val => onSetField('category', val)}
              options={categorySelectOptions}
              className="w-full"
            />
          </FormField>

          <FormField label="Ledger category" error={errors.ledgerCategory}>
            <CustomSelect
              ariaLabel="Ledger category"
              value={state.ledgerCategory}
              placeholder="Select a ledger category"
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

          {state.ledgerCategory === 'Income' && (
            <IncomeSplitAccountsCard
              state={state}
              accounts={accounts}
              errors={errors}
              onSetSplitAccountId={onSetSplitAccountId}
            />
          )}

          {accountBucket && (
            <FormField
              label="Account"
              required
              error={errors.accountId}
            >
              <CustomSelect
                ariaLabel="Account"
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

      {transactionCycle && (
        <AlertBanner variant="info" className="sm:col-span-2">
          This posting date belongs to {transactionCycle.label}, not the cycle you are viewing. When this transaction reaches the Ledger, it will appear there.
        </AlertBanner>
      )}

      {bucketOutflowWarning && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs sm:col-span-2"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
          <div className="space-y-0.5 min-w-0 flex-1">
            <p className="font-bold text-amber-600 dark:text-amber-400">
              {bucketOutflowWarning.message}
            </p>
            <p className="text-muted-foreground">
              Shortfall of <span className="font-semibold text-foreground">{formatCurrencyVal(bucketOutflowWarning.shortfall, currency)}</span>. You can still save this transaction to keep your records accurate.
            </p>
          </div>
        </div>
      )}

      {isStabilityReloadFormDrawdown(state) && (
        <StabilityReloadIntentCard
          state={state}
          errors={errors}
          onSetField={onSetField}
        />
      )}
    </>
  )
}
