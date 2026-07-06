import React, { useState } from 'react'
import type { Transaction } from '../types'
import { FileText, Edit2, Trash2, ArrowLeft, Plus, AlertCircle } from 'lucide-react'
import { formatCurrencyVal } from '../lib/utils'
import { SwipeableRow } from './ui/SwipeableRow'
import { getCategoryBadgeClass } from '../lib/categoryColors'

interface DraftStagingViewProps {
  draftTransactions: Transaction[]
  onUpdateDraftTransaction: (id: string, updated: Transaction) => void
  onDeleteDraftTransaction: (id: string) => void
  hideSensitive: boolean
  currency?: string
  onCancel: () => void
  onAddAnother?: () => void
}

export const DraftStagingView: React.FC<DraftStagingViewProps> = ({
  draftTransactions,
  onUpdateDraftTransaction,
  onDeleteDraftTransaction,
  hideSensitive,
  currency = 'USD',
  onCancel,
  onAddAnother
}) => {
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)

  // Edit Form States
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [validationErrors, setValidationErrors] = useState<{
    description?: string
    amount?: string
    date?: string
  }>({})

  const formatCurrency = (val: number) => {
    return formatCurrencyVal(val, currency)
  }

  const formatSensitive = (val: number) => {
    return (
      <span className={hideSensitive ? 'blur-xs select-none pointer-events-none' : ''}>
        {formatCurrency(val)}
      </span>
    )
  }

  const handleStartEdit = (draft: Transaction) => {
    if (hideSensitive) return
    setEditingDraftId(draft.id)
    setDescription(draft.description)
    setAmount(Math.abs(draft.amount).toString())
    setDate(draft.date)
    setValidationErrors({})
  }

  const handleSaveEdit = (draft: Transaction) => {
    const errors: { description?: string; amount?: string; date?: string } = {}
    if (!description.trim()) {
      errors.description = 'Description is required'
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount)) {
      errors.amount = 'Amount must be a valid number'
    } else if (parsedAmount <= 0) {
      errors.amount = 'Amount must be greater than zero'
    }
    if (!date) {
      errors.date = 'Date is required'
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    setValidationErrors({})
    const sign = draft.amount < 0 ? -1 : 1
    onUpdateDraftTransaction(draft.id, {
      ...draft,
      description: description.trim(),
      amount: parsedAmount * sign,
      date
    })
    setEditingDraftId(null)
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4 soft-rise">

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
            return (
              <div
                key={draft.id}
                className="p-4 rounded-2xl bg-card border border-blue-500/30 shadow-md space-y-3 animate-in zoom-in-95 duration-150"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Description</label>
                    <input
                      type="text"
                      required
                      value={description}
                      onChange={e => {
                        setDescription(e.target.value)
                        if (validationErrors.description) {
                          setValidationErrors(prev => ({ ...prev, description: undefined }))
                        }
                      }}
                      className={`w-full px-3 py-2 text-xs bg-background border rounded-xl focus:outline-none focus:ring-1 transition-all duration-200 ${
                        validationErrors.description 
                          ? 'border-red-500/50 focus:ring-red-500 text-red-600 dark:text-red-400 bg-red-500/5' 
                          : 'border-border focus:ring-blue-500'
                      }`}
                    />
                    {validationErrors.description && (
                      <div className="text-[10px] text-red-500 font-semibold flex items-center gap-1 mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <AlertCircle className="size-3 shrink-0" />
                        <span>{validationErrors.description}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={amount}
                      onChange={e => {
                        setAmount(e.target.value)
                        if (validationErrors.amount) {
                          setValidationErrors(prev => ({ ...prev, amount: undefined }))
                        }
                      }}
                      className={`w-full px-3 py-2 text-xs bg-background border rounded-xl focus:outline-none focus:ring-1 transition-all duration-200 ${
                        validationErrors.amount 
                          ? 'border-red-500/50 focus:ring-red-500 text-red-600 dark:text-red-400 bg-red-500/5' 
                          : 'border-border focus:ring-blue-500'
                      }`}
                    />
                    {validationErrors.amount && (
                      <div className="text-[10px] text-red-500 font-semibold flex items-center gap-1 mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <AlertCircle className="size-3 shrink-0" />
                        <span>{validationErrors.amount}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={e => {
                        setDate(e.target.value)
                        if (validationErrors.date) {
                          setValidationErrors(prev => ({ ...prev, date: undefined }))
                        }
                      }}
                      className={`w-full px-3 py-2 text-xs bg-background border rounded-xl focus:outline-none focus:ring-1 transition-all duration-200 ${
                        validationErrors.date 
                          ? 'border-red-500/50 focus:ring-red-500 text-red-600 dark:text-red-400 bg-red-500/5' 
                          : 'border-border focus:ring-blue-500'
                      }`}
                    />
                    {validationErrors.date && (
                      <div className="text-[10px] text-red-500 font-semibold flex items-center gap-1 mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <AlertCircle className="size-3 shrink-0" />
                        <span>{validationErrors.date}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditingDraftId(null)}
                    className="px-3.5 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 font-bold text-xs rounded-xl transition duration-150 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveEdit(draft)}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition duration-150 cursor-pointer shadow-md"
                  >
                    Save
                  </button>
                </div>
              </div>
            )
          }

          const ledgerLabel = (draft.ledgerCategory || '').startsWith('Transfer:') ? 'Transfer' : (draft.ledgerCategory || '')

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
                    className="flex-1 flex flex-col items-center justify-center gap-1 bg-blue-500 text-white text-[11px] font-bold active:bg-blue-600 transition disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Edit2 className="size-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => { if (!hideSensitive) onDeleteDraftTransaction(draft.id) }}
                    disabled={hideSensitive}
                    className="flex-1 flex flex-col items-center justify-center gap-1 bg-red-500 text-white text-[11px] font-bold active:bg-red-600 transition disabled:opacity-50 disabled:pointer-events-none"
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
                    className="p-2 hover:bg-red-500/10 rounded-xl text-muted-foreground hover:text-red-500 cursor-pointer transition select-none disabled:opacity-40 disabled:cursor-not-allowed"
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
                    <span className={`inline-block px-1.5 py-0.5 rounded-md border font-semibold ${getCategoryBadgeClass(draft.ledgerCategory)}`}>
                      {ledgerLabel}
                    </span>
                    <span className={`inline-block px-1.5 py-0.5 rounded-md border font-semibold ${getCategoryBadgeClass(draft.category)}`}>
                      {draft.category}
                    </span>
                  </div>
                </div>
                <span className={`shrink-0 font-extrabold text-sm ${draft.amount < 0 ? 'text-orange-500' : 'text-blue-500'}`}>
                  {draft.amount > 0 ? '+' : ''}
                  {formatSensitive(draft.amount)}
                </span>
              </div>
            </SwipeableRow>
          )
        })}
      </div>

      {/* Prominent full-width add-entry action */}
      {onAddAnother && (
        <button
          onClick={onAddAnother}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-4 rounded-2xl border-2 border-dashed border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/60 text-blue-600 dark:text-blue-400 font-bold text-sm cursor-pointer transition select-none active:scale-[0.99]"
        >
          <span className="flex items-center justify-center size-7 rounded-full bg-blue-600 text-white shadow-md shadow-blue-600/20">
            <Plus className="size-4" />
          </span>
          Add Another Entry
        </button>
      )}

    </div>
  )
}
