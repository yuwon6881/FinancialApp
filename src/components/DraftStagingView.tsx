import React, { useState } from 'react'
import type { Transaction } from '../types'
import { FileText, Edit2, Trash2, ArrowLeft } from 'lucide-react'
import { formatCurrencyVal } from '../lib/utils'

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
    setEditingDraftId(draft.id)
    setDescription(draft.description)
    setAmount(Math.abs(draft.amount).toString())
    setDate(draft.date)
  }

  const handleSaveEdit = (draft: Transaction) => {
    const parsedAmount = parseFloat(amount)
    if (!description.trim() || isNaN(parsedAmount) || parsedAmount <= 0 || !date) {
      alert('Please fill out all fields correctly.')
      return
    }

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
    <div className="space-y-6 max-w-3xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
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
              <span>Queueing Transactions</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Pending upload to server.</p>
          </div>
        </div>

        {onAddAnother && (
          <button
            onClick={onAddAnother}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition select-none shrink-0"
          >
            <span>+ Add Entry</span>
          </button>
        )}
      </div>

      {/* Draft Items List */}
      <div className="space-y-3">
        {draftTransactions.map(draft => {
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
                      onChange={e => setDescription(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
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

          return (
            <div 
              key={draft.id} 
              className="p-4 rounded-xl bg-card border border-border/60 hover:border-amber-500/20 shadow-xs flex items-center justify-between gap-4 transition duration-200"
            >
              <div className="min-w-0 flex-1">
                <div className="font-bold text-foreground text-sm truncate">{draft.description}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {draft.date} • <span className="font-semibold text-muted-foreground">{draft.ledgerCategory.startsWith('Transfer:') ? 'Transfer' : draft.ledgerCategory}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 font-semibold text-xs">
                <span className={`font-extrabold text-sm ${draft.amount < 0 ? 'text-orange-500' : 'text-blue-500'}`}>
                  {draft.amount > 0 ? '+' : ''}
                  {formatSensitive(draft.amount)}
                </span>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleStartEdit(draft)}
                    className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground cursor-pointer transition select-none"
                    title="Edit draft item"
                  >
                    <Edit2 className="size-4" />
                  </button>
                  <button
                    onClick={() => onDeleteDraftTransaction(draft.id)}
                    className="p-2 hover:bg-red-500/10 rounded-xl text-muted-foreground hover:text-red-500 cursor-pointer transition select-none"
                    title="Remove from batch list"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>


    </div>
  )
}
