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
import { CategoryTiles, ChipPicker } from './TransactionPickers'
import { getCategoryChartColor } from '../../../lib/categoryColors'
import { cn } from '../../../lib/utils'

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
  /** Sits directly under the amount: the receipt scan and split shortcuts. */
  amountAccessory?: React.ReactNode
}

const BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const
const QUICK_CATEGORY_COUNT = 8
const MAX_ACCOUNT_CHIPS = 4

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
  amountAccessory,
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

  // The tiles: suggestions first (they lead the options), with the current choice always among them.
  const quickCategoryOptions = React.useMemo(() => {
    const quick = categorySelectOptions.slice(0, QUICK_CATEGORY_COUNT)
    const current = categorySelectOptions.find(option => option.value === state.category)
    if (current && !quick.includes(current)) quick.splice(QUICK_CATEGORY_COUNT - 1, 1, current)
    return quick
  }, [categorySelectOptions, state.category])

  const bucketOptions = React.useMemo(() => [
    ...(state.transactionType === 'inflow' ? [{ value: 'Income', label: 'Split income', swatch: 'var(--primary)' }] : []),
    ...BUCKETS.map(bucket => ({ value: bucket, label: bucket, swatch: getCategoryChartColor(bucket) })),
  ], [state.transactionType])

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
    const bucketAccounts = accounts.filter(account =>
      account.bucket === accountBucket && (!account.isArchived || account.id === state.accountId),
    )
    return [
      { value: '', label: accountBucket ? 'Choose ' + accountBucket + ' account' : 'Choose source category first', disabled: false },
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
      { value: '', label: state.transferTarget ? 'Choose ' + state.transferTarget + ' account' : 'Choose target category first', disabled: false },
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
      <FormField
        className="sm:col-span-2"
        label={`Amount (${getCurrencySymbol(currency).trim()})`}
        required
        error={errors.amount}
      >
        {/* The figure the whole form is about, set at hero size so it reads before anything else;
            inflow reads green as it does everywhere else in the app. */}
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-10 z-10 -translate-y-1/2 select-none text-section font-medium text-muted-foreground lg:top-9">
            {getCurrencySymbol(currency).trim()}
          </span>
          <SmartAmountInput
            type="text"
            placeholder="0.00"
            value={state.amount}
            calculator="tray"
            onChange={e => {
              onSetField('amount', maskCurrencyInput(e.target.value, state.amount))
            }}
            className={cn(
              'input-display h-20 w-full pr-4 text-hero font-semibold tabular-nums lg:h-[4.5rem]',
              state.transactionType === 'inflow' && 'text-emerald-600 dark:text-emerald-400',
              getCurrencySymbol(currency).trim().length > 2 ? 'pl-[4.75rem]' : getCurrencySymbol(currency).trim().length > 1 ? 'pl-16' : 'pl-11',
            )}
          />
        </div>
      </FormField>

      {amountAccessory}

      <TransactionDescriptionField
        key={state.transactionType}
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
                <span className="absolute right-0 top-0 inline-flex items-center gap-1 whitespace-nowrap text-caption font-medium text-accent-ink">
                  <Loader2 className="size-3 animate-spin" /> Suggesting
                </span>
              ) : suggestions.categorySuggestionUnavailable ? (
                <span className="absolute right-0 top-0 whitespace-nowrap text-caption font-medium text-amber-700 dark:text-amber-400">
                  AI unavailable
                </span>
              ) : null}
            <CategoryTiles
              value={state.category}
              options={quickCategoryOptions}
              onChange={val => onSetField('category', val)}
            />
            {categorySelectOptions.length > quickCategoryOptions.length && (
              <CustomSelect
                ariaLabel="Category"
                value={state.category}
                placeholder="More categories"
                onChange={val => onSetField('category', val)}
                options={categorySelectOptions}
                className="mt-2 w-full"
              />
            )}
          </FormField>

          <div className="space-y-2 sm:col-span-2">
            <p className="text-label font-medium text-muted-foreground" aria-hidden="true">
              {state.transactionType === 'inflow' ? 'Into bucket' : 'From bucket'}
            </p>
            <ChipPicker
              label={state.transactionType === 'inflow' ? 'Into bucket' : 'From bucket'}
              value={state.ledgerCategory || null}
              options={bucketOptions}
              onChange={val => onSetField('ledgerCategory', val as SelectableLedgerCategory)}
              className="grid grid-cols-2 sm:grid-cols-4 [&>*]:w-full [&>*]:justify-start"
            />
            {errors.ledgerCategory && <p className="text-caption text-destructive" role="alert">{errors.ledgerCategory}</p>}
          </div>

          {state.ledgerCategory === 'Income' && (
            <IncomeSplitAccountsCard
              state={state}
              accounts={accounts}
              errors={errors}
              onSetSplitAccountId={onSetSplitAccountId}
            />
          )}

          {accountBucket && (
            accountOptions.length - 1 <= MAX_ACCOUNT_CHIPS ? (
              <div className="space-y-2 sm:col-span-2">
                <p className="text-label font-medium text-muted-foreground" aria-hidden="true">
                  Account<span className="text-destructive"> *</span>
                </p>
                {accountOptions.length > 1 ? (
                  <ChipPicker
                    label="Account"
                    value={state.accountId}
                    options={accountOptions.slice(1)}
                    onChange={value => onSetField('accountId', value || null)}
                  />
                ) : (
                  <p className="text-caption text-muted-foreground">No {accountBucket} account yet. Add one in Wealth › Accounts.</p>
                )}
                {errors.accountId && <p className="text-caption text-destructive" role="alert">{errors.accountId}</p>}
              </div>
            ) : (
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
            )
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
          className="flex items-start gap-3 rounded-control bg-amber-500/10 p-3.5 text-label sm:col-span-2"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-semibold text-foreground">
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
