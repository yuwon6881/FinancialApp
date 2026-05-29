import React, { useState } from 'react'
import type { RecurringPayment, TransactionCategory } from '../types'
import { 
  Plus, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  CreditCard, 
  Calendar, 
  Bell, 
  DollarSign, 
  Sparkles,
  X,
  Edit
} from 'lucide-react'
import { formatCurrencyVal } from '../lib/utils'

interface RecurringPaymentsViewProps {
  payments: RecurringPayment[]
  onAddPayment: (payment: Omit<RecurringPayment, 'id'>) => void
  onToggleActive: (id: string) => void
  onDeletePayment: (id: string) => void
  onUpdatePayment: (id: string, payment: RecurringPayment) => void
  hideSensitive: boolean
  categories: TransactionCategory[]
  currency?: string
}

export const RecurringPaymentsView: React.FC<RecurringPaymentsViewProps> = ({
  payments,
  onAddPayment,
  onToggleActive,
  onDeletePayment,
  onUpdatePayment,
  hideSensitive,
  categories,
  currency = 'USD'
}) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingPayment, setEditingPayment] = useState<RecurringPayment | null>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [ledgerCategory, setLedgerCategory] = useState<'Essentials' | 'Growth' | 'Stability' | 'Rewards'>('Essentials')
  const [startDateInput, setStartDateInput] = useState('')
  const [endDateInput, setEndDateInput] = useState('')

  React.useEffect(() => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0].name)
    }
  }, [categories, category])

  const totalCommittedMonthly = payments
    .filter(p => p.active)
    .reduce((acc, p) => acc + Math.abs(p.amount), 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !amount || !startDateInput) return
    
    // Parse the start date to extract the day of the month as DueDate
    // HTML date inputs are yyyy-MM-dd
    const dateParts = startDateInput.split('-')
    const dueDay = dateParts.length === 3 ? parseInt(dateParts[2]) : 15

    const paymentData = {
      name,
      amount: -Math.abs(parseFloat(amount)), // Excel outlays are stored as negative
      frequency: 'Monthly' as const,
      category,
      ledgerCategory,
      nextDueDate: startDateInput,
      dueDate: dueDay,
      startDate: startDateInput,
      endDate: endDateInput || undefined
    }

    if (editingPayment) {
      onUpdatePayment(editingPayment.id, {
        ...editingPayment,
        ...paymentData,
        active: editingPayment.active
      })
    } else {
      onAddPayment({
        ...paymentData,
        active: true
      })
    }
    
    // Reset form
    setName('')
    setAmount('')
    setStartDateInput('')
    setEndDateInput('')
    setLedgerCategory('Essentials')
    setEditingPayment(null)
    setShowAddForm(false)
  }

  const handleCancelForm = () => {
    setName('')
    setAmount('')
    setStartDateInput('')
    setEndDateInput('')
    setLedgerCategory('Essentials')
    setEditingPayment(null)
    setShowAddForm(false)
  }

  const formatCurrency = (val: number) => {
    return formatCurrencyVal(val, currency)
  }

  const formatSensitive = (val: number) => {
    return (
      <span className={hideSensitive ? 'blur-sm select-none pointer-events-none inline-block transition-all duration-200' : 'transition-all duration-200'}>
        {formatCurrency(val)}
      </span>
    )
  }



  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Header section with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-xs md:col-span-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Recurring Bills & Subscriptions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Track, toggle, and manage your recurring committed outlays.</p>
            <div className="flex gap-4 mt-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Monthly Total</span>
                <span className="text-2xl font-extrabold text-blue-500">{formatSensitive(totalCommittedMonthly)}</span>
              </div>
              <div className="border-l border-border/60 pl-4">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Active Subscriptions</span>
                <span className="text-2xl font-extrabold text-foreground">{payments.filter(p => p.active).length} / {payments.length}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              if (showAddForm) {
                handleCancelForm()
              } else {
                setShowAddForm(true)
              }
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 transition duration-200 cursor-pointer self-start md:self-center"
          >
            {showAddForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showAddForm ? 'Cancel' : 'New Subscription'}
          </button>
        </div>

        {/* Info card */}
        <div className="p-6 rounded-2xl bg-radial from-blue-950/20 via-card to-card border border-blue-500/10 flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Excel Seeding Active</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Subscriptions are automatically filtered month-by-month. Start dates determine when bills first appear in your monthly ledger reports.
            </p>
          </div>
        </div>
      </div>

      {/* Add Subscription Form Drawer/Panel */}
      {showAddForm && (
        <div className="p-6 rounded-2xl bg-card border border-blue-500/20 shadow-md animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-md font-semibold text-foreground mb-4 flex items-center gap-2">
            {editingPayment ? <Edit className="size-4 text-blue-500" /> : <Plus className="size-4 text-blue-500" />} 
            {editingPayment ? 'Edit Subscription' : 'Add New Recurring Payment'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Subscription Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Netflix, Spotify"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Billing Amount ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Budget Category</label>
              <select
                value={category || (categories[0]?.name || '')}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Start Billing Date</label>
              <input
                type="date"
                required
                value={startDateInput}
                onChange={e => setStartDateInput(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Ledger Category</label>
              <select
                value={ledgerCategory}
                onChange={e => setLedgerCategory(e.target.value as any)}
                className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
              >
                <option value="Essentials">Essentials</option>
                <option value="Growth">Growth</option>
                <option value="Stability">Stability</option>
                <option value="Rewards">Rewards</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">End Billing Date (Optional)</label>
              <input
                type="date"
                value={endDateInput}
                onChange={e => setEndDateInput(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
              />
            </div>

            <div className="md:col-span-3 pt-2">
              <button
                type="submit"
                className="w-full md:w-auto px-6 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition duration-200 cursor-pointer"
              >
                {editingPayment ? 'Update Subscription' : 'Save Subscription'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subscriptions Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {payments.map(rp => {
          return (
            <div 
              key={rp.id} 
              className={`p-6 rounded-2xl bg-card border transition-all duration-300 flex flex-col justify-between ${
                rp.active 
                  ? 'border-border/60 hover:border-blue-500/30 shadow-xs' 
                  : 'border-dashed border-border/60 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-md font-bold text-foreground flex items-center gap-1.5">
                      {rp.name}
                      {!rp.active && (
                        <span className="text-[9px] font-semibold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Paused</span>
                      )}
                    </h3>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{rp.category}</span>
                  </div>
                  
                  {/* Status Toggle Button */}
                  <button 
                    onClick={() => onToggleActive(rp.id)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer transition duration-150"
                  >
                    {rp.active ? (
                      <ToggleRight className="size-8 text-blue-500" />
                    ) : (
                      <ToggleLeft className="size-8" />
                    )}
                  </button>
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-foreground">{formatSensitive(Math.abs(rp.amount))}</span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                </div>

                <div className="mt-6 space-y-2 border-t border-border/30 pt-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="size-3.5" /> Billing Period
                    </span>
                    <span className="text-foreground font-medium">
                      Starts {rp.startDate} (Day {rp.dueDate})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <CreditCard className="size-3.5" /> Ledger Category
                    </span>
                    <span className="text-foreground font-medium">{rp.ledgerCategory}</span>
                  </div>
                  {rp.endDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="size-3.5" /> End Date
                      </span>
                      <span className="text-foreground font-medium">{rp.endDate}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-border/30 pt-4">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Bell className="size-3 text-blue-500" /> Auto-notify active
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setName(rp.name)
                      setAmount(Math.abs(rp.amount).toString())
                      setCategory(rp.category)
                      setLedgerCategory(rp.ledgerCategory as any)
                      setStartDateInput(rp.startDate)
                      setEndDateInput(rp.endDate || '')
                      setEditingPayment(rp)
                      setShowAddForm(true)
                    }}
                    className="p-2 rounded-lg text-blue-500 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 cursor-pointer transition duration-150"
                    title="Edit subscription"
                  >
                    <Edit className="size-3.5" />
                  </button>
                  <button
                    onClick={() => onDeletePayment(rp.id)}
                    className="p-2 rounded-lg text-orange-500 hover:bg-orange-500/10 border border-transparent hover:border-orange-500/20 cursor-pointer transition duration-150"
                    title="Delete subscription"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        
        {payments.length === 0 && (
          <div className="p-12 text-center border border-dashed border-border rounded-2xl md:col-span-3 text-muted-foreground text-sm">
            You don't have any subscription added yet. Click "New Subscription" above to create one.
          </div>
        )}
      </div>
    </div>
  )
}
