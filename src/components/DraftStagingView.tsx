import { Input } from './ui/Input'
import React, { useMemo, useRef, useState } from 'react'
import type { Transaction, TransactionCategory } from '../types'
import { FileText, Edit2, Trash2, ArrowLeft, Plus, Sparkles, Loader2 } from 'lucide-react'
import { formatCurrencyVal, maskCurrencyInput, getCurrencySymbol } from '../lib/utils'
import { SwipeableRow } from './ui/SwipeableRow'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import { SmartAmountInput } from './ui/SmartAmountInput'
import { SearchableSelect } from './ui/SearchableSelect'
import { CustomSelect } from './ui/CustomSelect'
import { DatePicker } from './ui/DatePicker'
import { PerimeterBeam } from './ui/PerimeterBeam'
import { AnchoredPopover } from './ui/AnchoredPopover'
import { LedgerAllocationBadge } from './ledger/LedgerAllocationBadge'
import { SensitiveMask } from './ui/SensitiveAmount'
import { useTransactionSuggestions } from './ledger/transaction-form/useTransactionSuggestions'
import { FormField } from './ui/FormField'
import { focusFirstInvalidField } from './ui/formValidation'
import { Button } from './ui/Button'
import { ModalActions } from './ui/ModalActions'

const TRANSFER_BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards']

interface DraftStagingViewProps {
  draftTransactions: Transaction[]
  onUpdateDraftTransaction: (id: string, updated: Transaction) => void
  onDeleteDraftTransaction: (id: string) => void
  categories: TransactionCategory[]
  hideSensitive: boolean
  currency?: string
  onCancel: () => void
  onAddAnother?: () => void
}

export const DraftStagingView: React.FC<DraftStagingViewProps> = ({
  draftTransactions,
  onUpdateDraftTransaction,
  onDeleteDraftTransaction,
  categories,
  hideSensitive,
  currency = 'USD',
  onCancel,
  onAddAnother
}) => {
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Edit Form States
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [category, setCategory] = useState('')
  const [ledgerCategory, setLedgerCategory] = useState('Essentials')
  const [transferSource, setTransferSource] = useState('Essentials')
  const [transferTarget, setTransferTarget] = useState('Growth')
  const descriptionAnchorRef = useRef<HTMLDivElement>(null)

  const normalCategoryOptions = categories
    .filter(item => !item.isPendingDelete && !['transfer', 'adjustment'].includes(item.name.trim().toLowerCase()))
    .map(item => item.name.trim())
    .filter((name, index, names) => !!name && names.findIndex(candidate => candidate.toLowerCase() === name.toLowerCase()) === index)

  // Mirror the ledger add-entry form's AI helpers (note clean-up + suggested
  // category) for the draft being edited. `editingTxId` is left null so the
  // hook enables category suggestions, which it skips while editing a saved tx.
  const editingDraft = draftTransactions.find(draft => draft.id === editingDraftId) ?? null
  const editingIsTransfer = editingDraft?.ledgerCategory.startsWith('Transfer:') ?? false
  const editTxType: 'inflow' | 'outflow' | 'transfer' = editingIsTransfer
    ? 'transfer'
    : editingDraft && editingDraft.amount > 0 ? 'inflow' : 'outflow'

  const suggestions = useTransactionSuggestions({
    categories,
    editingTxId: null,
    showAddForm: true,
    txType: editTxType,
    activeSuggestionEntries: [],
    category,
    ledgerCategory,
  })

  // Merge AI-suggested categories (with a confidence badge) ahead of the full
  // list, mirroring TransactionFormFields' category select.
  const categorySelectOptions = useMemo(() => {
    const canonicalByName = new Map(normalCategoryOptions.map(name => [name.toLowerCase(), name]))
    const suggestedNames = new Set<string>()
    const suggestedOptions = suggestions.categorySuggestions.map(suggestion => {
      const canonicalName = canonicalByName.get(String(suggestion.category).toLowerCase())
      if (!canonicalName || suggestedNames.has(canonicalName.toLowerCase())) return null
      suggestedNames.add(canonicalName.toLowerCase())
      const badge = Number.isFinite(suggestion.confidence)
        ? `Suggested ${Math.round(Math.max(0, Math.min(1, suggestion.confidence)) * 100)}%`
        : 'Suggested'
      return { value: canonicalName, label: canonicalName, badge }
    }).filter((option): option is { value: string; label: string; badge: string } => option !== null)
    return [
      ...suggestedOptions,
      ...normalCategoryOptions
        .filter(name => !suggestedNames.has(name.toLowerCase()))
        .map(name => ({ value: name, label: name })),
    ]
  }, [normalCategoryOptions, suggestions.categorySuggestions])

  const formatCurrency = (val: number) => {
    return formatCurrencyVal(val, currency)
  }

  const formatSensitive = (val: number) => {
    return hideSensitive ? <SensitiveMask /> : <span>{formatCurrency(val)}</span>
  }

  const handleStartEdit = (draft: Transaction) => {
    if (hideSensitive) return
    setEditingDraftId(draft.id)
    setDescription(draft.description)
    setAmount(Math.abs(draft.amount).toFixed(2))
    setDate(draft.date)
    setCategory(draft.category)
    setLedgerCategory(draft.ledgerCategory)
    if (draft.ledgerCategory.startsWith('Transfer:')) {
      const [source, target] = draft.ledgerCategory.substring('Transfer:'.length).split('->')
      setTransferSource(source?.trim() || 'Essentials')
      setTransferTarget(target?.trim() || 'Growth')
    }
    setErrors({})
    suggestions.clearSuggestions()
  }

  const handleSaveEdit = (event: React.FormEvent<HTMLFormElement>, draft: Transaction) => {
    event.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!description.trim()) {
      newErrors.description = 'Description is required.'
    }
    const parsedAmount = parseFloat(amount)
    if (!amount.trim()) {
      newErrors.amount = 'Amount is required.'
    } else if (isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = 'Please enter a valid amount greater than 0.'
    }
    if (!date) {
      newErrors.date = 'Date is required.'
    }
    const isTransferDraft = draft.ledgerCategory.startsWith('Transfer:')
    if (!isTransferDraft && !category) {
      newErrors.category = 'Category is required.'
    }
    if (!isTransferDraft && !ledgerCategory) {
      newErrors.ledgerCategory = 'Ledger category is required.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      focusFirstInvalidField(event.currentTarget)
      return
    }
    setErrors({})

    const sign = draft.amount < 0 ? -1 : 1
    onUpdateDraftTransaction(draft.id, {
      ...draft,
      description: description.trim(),
      amount: parsedAmount * sign,
      date,
      category: isTransferDraft ? draft.category : category,
      ledgerCategory: isTransferDraft ? `Transfer:${transferSource}->${transferTarget}` : ledgerCategory,
    })
    setEditingDraftId(null)
    suggestions.clearSuggestions()
  }

  const handleCancelEdit = () => {
    setEditingDraftId(null)
    suggestions.clearSuggestions()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 soft-rise">

      {/* Header section */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground cursor-pointer transition select-none"
            title="Go back"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileText className="size-5 text-amber-500" />
              <span>Queue</span>
            </h2>
          </div>
        </div>
      </div>

      {/* Draft Items List */}
      <div className="space-y-3">
        {draftTransactions.map((draft, idx) => {
          const isEditing = editingDraftId === draft.id

          if (isEditing) {
            const isTransferDraft = draft.ledgerCategory.startsWith('Transfer:')
            const ledgerOptions = [
              ...(draft.amount > 0 ? ['Income'] : []),
              'Essentials', 'Growth', 'Stability', 'Rewards'
            ]
            return (
              <form
                key={draft.id}
                noValidate
                onSubmit={event => handleSaveEdit(event, draft)}
                className="p-4 sm:p-5 rounded-2xl bg-card border border-blue-500/30 shadow-md space-y-4 animate-in zoom-in-95 duration-150"
              >
                <div className="flex items-center gap-2 pb-1">
                  <Edit2 className="size-3.5 text-blue-500" />
                  <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">Edit Entry</span>
                </div>

                {/* Description — full width */}
                <div className="space-y-1.5 relative">
                  {!isTransferDraft && (
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => void suggestions.requestNoteSuggestions(description.trim())}
                      disabled={suggestions.isSuggestingNote || description.trim().length < 2}
                      title={description.trim().length < 2 ? 'Enter a description first' : 'Suggest cleaner notes'}
                      className="absolute right-0 top-0 z-10 inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/5 px-2 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      {suggestions.isSuggestingNote ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                      AI
                    </button>
                  )}
                  {/* rounded-xl matches the input inside: the beam inherits the host's
                      radius, and a square host would corner the trace off the field. */}
                  <FormField label="Description" labelClassName="pr-10 text-[10px] uppercase tracking-wider" required error={errors.description}>
                    <div ref={descriptionAnchorRef} className={`relative rounded-xl ${suggestions.isSuggestingNote ? 'perimeter-beam-host' : ''}`}>
                      {suggestions.isSuggestingNote && <PerimeterBeam size={40} />}
                      <Input
                        type="text"
                        value={description}
                        onChange={e => {
                          setDescription(e.target.value)
                          suggestions.setShowNoteSuggestions(false)
                          suggestions.setNoteSuggestions([])
                          suggestions.setIsSuggestingNote(false)
                          if (errors.description) {
                            setErrors(prev => ({ ...prev, description: '' }))
                          }
                        }}
                        onBlur={() => { if (!isTransferDraft) void suggestions.requestCategorySuggestions(description.trim(), null) }}
                        controlSize="sm"
                      />
                    </div>
                  </FormField>

                  <AnchoredPopover
                    open={suggestions.showNoteSuggestions}
                    anchorRef={descriptionAnchorRef}
                    matchAnchorWidth
                    side="bottom"
                    className="z-[200] overflow-y-auto overscroll-contain bg-card border border-blue-500/25 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                      {suggestions.isSuggestingNote ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                          <Loader2 className="size-3.5 animate-spin text-blue-500" />
                          Suggesting cleaner notes...
                        </div>
                      ) : suggestions.noteSuggestions.length > 0 ? (
                        suggestions.noteSuggestions.map(s => (
                          <button
                            key={s.note}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setDescription(s.note)
                              suggestions.setShowNoteSuggestions(false)
                              if (errors.description) setErrors(prev => ({ ...prev, description: '' }))
                            }}
                            className="w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 cursor-pointer transition duration-100 hover:bg-blue-500/10 first:rounded-t-xl last:rounded-b-xl"
                          >
                            <span className="font-semibold text-foreground">{s.note}</span>
                            <span className="text-[10px] text-muted-foreground">{s.reason}</span>
                          </button>
                        ))
                      ) : suggestions.noteSuggestionUnavailable ? (
                        <div className="px-3 py-2.5 text-xs font-semibold text-amber-600 dark:text-amber-500">
                          AI suggestions are unavailable right now. Please try again.
                        </div>
                      ) : (
                        <div className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                          No better note found for this description.
                        </div>
                      )}
                  </AnchoredPopover>
                </div>

                {/* Amount + Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    label={`Amount (${getCurrencySymbol(currency)})`}
                    required
                    error={errors.amount}
                    labelClassName="text-[10px] uppercase tracking-wider"
                    errorClassName="text-[10px]"
                  >
                    <div className="relative flex items-center">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-xs font-semibold text-muted-foreground pointer-events-none select-none leading-none">
                        {getCurrencySymbol(currency)}
                      </span>
                      <SmartAmountInput
                        type="text"
                        placeholder="0.00"
                        value={amount}
                        onChange={e => {
                          setAmount(maskCurrencyInput(e.target.value, amount))
                          if (errors.amount) {
                            setErrors(prev => ({ ...prev, amount: '' }))
                          }
                        }}
                        className={`w-full pr-3 text-xs ${
                          getCurrencySymbol(currency).length > 2 ? 'pl-11' : getCurrencySymbol(currency).length > 1 ? 'pl-9' : 'pl-7'
                        }`}
                      />
                    </div>
                  </FormField>
                  <FormField
                    label="Date"
                    required
                    error={errors.date}
                    labelClassName="text-[10px] uppercase tracking-wider"
                    errorClassName="text-[10px]"
                  >
                    <DatePicker
                      value={date}
                      onChange={value => {
                        setDate(value)
                        if (errors.date) {
                          setErrors(prev => ({ ...prev, date: '' }))
                        }
                      }}
                      className="w-full"
                    />
                  </FormField>
                </div>

                {isTransferDraft ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Source (from)" labelClassName="text-[10px] uppercase tracking-wider">
                      <CustomSelect
                        ariaLabel="Transfer source category"
                        value={transferSource}
                        onChange={value => {
                          setTransferSource(value)
                          // Keep source and target distinct, mirroring the ledger transfer form.
                          if (value === transferTarget) {
                            const fallback = TRANSFER_BUCKETS.find(bucket => bucket !== value)
                            if (fallback) setTransferTarget(fallback)
                          }
                        }}
                        options={TRANSFER_BUCKETS.map(option => ({ value: option, label: option }))}
                        className="w-full"
                      />
                    </FormField>

                    <FormField label="Target (to)" labelClassName="text-[10px] uppercase tracking-wider">
                      <CustomSelect
                        ariaLabel="Transfer target category"
                        value={transferTarget}
                        onChange={value => setTransferTarget(value)}
                        options={TRANSFER_BUCKETS.filter(option => option !== transferSource).map(option => ({ value: option, label: option }))}
                        className="w-full"
                      />
                    </FormField>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      {suggestions.isSuggestingCategory ? (
                        <span className="absolute right-0 top-0 inline-flex items-center gap-1 text-[9px] font-semibold text-blue-500 whitespace-nowrap">
                          <Loader2 className="size-3 animate-spin" /> Suggesting
                        </span>
                      ) : suggestions.categorySuggestionUnavailable ? (
                        <span className="absolute right-0 top-0 text-[9px] font-semibold text-amber-600 dark:text-amber-500 whitespace-nowrap">
                          AI unavailable
                        </span>
                      ) : null}
                      <FormField
                        label="Category"
                        labelClassName="pr-20 text-[10px] uppercase tracking-wider"
                        required
                        error={errors.category}
                        errorClassName="text-[10px]"
                      >
                      <SearchableSelect
                        ariaLabel="Category"
                        value={category}
                        onChange={value => {
                          setCategory(value)
                          if (errors.category) setErrors(previous => ({ ...previous, category: '' }))
                        }}
                        options={categorySelectOptions}
                        className="w-full"
                        placeholder="Search categories…"
                      />
                      </FormField>
                    </div>

                    <FormField
                      label="Ledger category"
                      required
                      error={errors.ledgerCategory}
                      labelClassName="text-[10px] uppercase tracking-wider"
                      errorClassName="text-[10px]"
                    >
                      <CustomSelect
                        ariaLabel="Ledger category"
                        value={ledgerCategory}
                        onChange={value => {
                          setLedgerCategory(value)
                          if (errors.ledgerCategory) setErrors(previous => ({ ...previous, ledgerCategory: '' }))
                        }}
                        options={ledgerOptions.map(option => ({ value: option, label: option }))}
                        className="w-full"
                      />
                    </FormField>
                  </div>
                )}

                <ModalActions className="pt-1">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={handleCancelEdit}
                    className="rounded-xl px-3.5 py-1.5"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="rounded-xl px-4 py-1.5 shadow-md"
                  >
                    Save
                  </Button>
                </ModalActions>
              </form>
            )
          }

          const rawLedgerCat = draft.ledgerCategory || ''
          const isTransfer = rawLedgerCat.startsWith('Transfer:')
          const outflow = draft.amount < 0
          // Mirror the ledger row: transfers are neither an in- nor out-flow, so
          // they carry no +/- sign and use the neutral blue accent; expenses are
          // orange, income is emerald.
          const amountColor = isTransfer ? 'text-blue-500' : outflow ? 'text-orange-500' : 'text-emerald-500'
          const amountSign = isTransfer ? '' : outflow ? '-' : '+'
          const displayAmount = outflow ? Math.abs(draft.amount) : draft.amount

          return (
            <SwipeableRow
              key={draft.id}
              hint={idx === 0}
              className="rounded-xl border border-border/60 hover:border-amber-500/20 shadow-xs transition duration-200"
              contentClassName="p-4"
              actionsWidth={128}
              actions={
                <>
                  <button
                    onClick={() => handleStartEdit(draft)}
                    disabled={hideSensitive}
                    className="flex-1 flex flex-col items-center justify-center gap-1 bg-primary text-primary-foreground text-[11px] font-bold active:bg-primary/80 transition disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Edit2 className="size-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => { if (!hideSensitive) onDeleteDraftTransaction(draft.id) }}
                    disabled={hideSensitive}
                    className="flex-1 flex flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground text-[11px] font-bold active:bg-destructive/80 transition disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </button>
                </>
              }
              desktopActions={
                <>
                  <button
                    onClick={() => handleStartEdit(draft)}
                    disabled={hideSensitive}
                    className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground cursor-pointer transition select-none disabled:opacity-40 disabled:cursor-not-allowed"
                    title={hideSensitive ? 'Unhide balances to edit' : 'Edit draft item'}
                  >
                    <Edit2 className="size-4" />
                  </button>
                  <button
                    onClick={() => { if (!hideSensitive) onDeleteDraftTransaction(draft.id) }}
                    disabled={hideSensitive}
                    className="p-2 hover:bg-destructive/10 rounded-xl text-muted-foreground hover:text-destructive cursor-pointer transition select-none disabled:opacity-40 disabled:cursor-not-allowed"
                    title={hideSensitive ? 'Unhide balances to edit' : 'Remove from batch list'}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </>
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-foreground text-sm truncate">{draft.description}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
                    <span>{draft.date}</span>
                    <LedgerAllocationBadge ledgerCategory={draft.ledgerCategory} transactionId={draft.id} compact />
                    {!isTransfer && (
                      <span className={`inline-block px-1.5 py-0.5 rounded-md border font-semibold ${getCategoryBadgeClass(draft.category)}`}>
                        {draft.category}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 font-extrabold text-sm ${amountColor}`}>
                  {amountSign}
                  {formatSensitive(displayAmount)}
                </span>
              </div>
            </SwipeableRow>
          )
        })}
      </div>

      {/* Prominent full-width add-entry action */}
      {onAddAnother && (
        <Button
          variant="outline"
          onClick={onAddAnother}
          className="w-full gap-2.5 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-4 text-sm text-accent-ink hover:border-primary/60 hover:bg-primary/10 active:scale-[0.99]"
        >
          <span className="flex items-center justify-center size-7 rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <Plus className="size-4" />
          </span>
          Add Another Entry
        </Button>
      )}

    </div>
  )
}
