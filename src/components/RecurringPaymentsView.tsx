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
  Sparkles,
  X,
  Edit
} from 'lucide-react'
import { formatCurrencyVal, getCurrencySymbol } from '../lib/utils'
import { CustomSelect } from './ui/CustomSelect'

interface RecurringPaymentsViewProps {
  payments: RecurringPayment[]
  onAddPayment: (payment: Omit<RecurringPayment, 'id'>) => void
  onToggleActive: (id: string) => void
  onDeletePayment: (id: string) => void
  onUpdatePayment: (id: string, payment: RecurringPayment) => void
  hideSensitive: boolean
  categories: TransactionCategory[]
  currency?: string
  autoOpenAddForm?: boolean
  onResetAutoOpen?: () => void
}

export const RecurringPaymentsView: React.FC<RecurringPaymentsViewProps> = ({
  payments,
  onAddPayment,
  onToggleActive,
  onDeletePayment,
  onUpdatePayment,
  hideSensitive,
  categories,
  currency = 'USD',
  autoOpenAddForm,
  onResetAutoOpen
}) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingPayment, setEditingPayment] = useState<RecurringPayment | null>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [ledgerCategory, setLedgerCategory] = useState<'Essentials' | 'Growth' | 'Stability' | 'Rewards'>('Essentials')
  const [startDateInput, setStartDateInput] = useState('')
  const [endDateInput, setEndDateInput] = useState('')

  // Filter & Sorting state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sortOrder, setSortOrder] = useState<string>('amount-desc')
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)

  // Toggle filter on or off
  const handleToggleCategoryFilter = (cat: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(cat)) {
        return prev.filter(c => c !== cat)
      } else {
        return [...prev, cat]
      }
    })
  }

  // Click outside to close filter dropdown
  React.useEffect(() => {
    if (!isFilterDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.recurring-filter-dropdown')) {
        setIsFilterDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [isFilterDropdownOpen])

  // Filter and Sort payments
  const filteredAndSortedPayments = React.useMemo(() => {
    let result = [...payments]
    
    // Filter by category (OR condition)
    if (selectedCategories.length > 0) {
      result = result.filter(p => selectedCategories.includes(p.ledgerCategory))
    }
    
    // Sort
    if (sortOrder === 'amount-desc') {
      result.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    } else if (sortOrder === 'amount-asc') {
      result.sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount))
    } else if (sortOrder === 'name-asc') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortOrder === 'due-date') {
      result.sort((a, b) => a.dueDate - b.dueDate)
    }
    return result
  }, [payments, selectedCategories, sortOrder])

  React.useEffect(() => {
    if (autoOpenAddForm) {
      setShowAddForm(true)
      onResetAutoOpen?.()
    }
  }, [autoOpenAddForm, onResetAutoOpen])

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
      <span className={hideSensitive ? 'blur-sm select-none pointer-events-none inline-block transition-[filter] duration-200' : 'transition-[filter] duration-200'}>
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
              <label className="text-xs font-semibold text-muted-foreground">Billing Amount ({getCurrencySymbol(currency)})</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs font-semibold text-muted-foreground pointer-events-none select-none">
                  {getCurrencySymbol(currency)}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className={`w-full pr-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200 ${
                    getCurrencySymbol(currency).length > 2 ? 'pl-11' : getCurrencySymbol(currency).length > 1 ? 'pl-9' : 'pl-7'
                  }`}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Budget Category</label>
              <CustomSelect
                value={category || (categories[0]?.name || '')}
                onChange={val => setCategory(val)}
                options={categories.map(c => ({ value: c.name, label: c.name }))}
                className="w-full"
              />
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
              <CustomSelect
                value={ledgerCategory}
                onChange={val => setLedgerCategory(val)}
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

      {/* Filter and Sort controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-card border border-border/60 rounded-2xl shadow-xs select-none">
        {/* Category Multi-select dropdown */}
        <div className="relative recurring-filter-dropdown w-full sm:w-auto">
          <button
            onClick={() => setIsFilterDropdownOpen(prev => !prev)}
            className="w-full sm:w-60 flex items-center justify-between gap-2 px-4 py-2 text-xs font-semibold bg-background border border-border rounded-xl hover:bg-muted transition duration-200 cursor-pointer select-none border-border/60"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="truncate">
                {selectedCategories.length === 0 
                  ? 'All Categories' 
                  : `${selectedCategories.length} category filter${selectedCategories.length > 1 ? 's' : ''} active`}
              </span>
            </span>
            <span className="text-[9px] text-muted-foreground">▼</span>
          </button>

          {isFilterDropdownOpen && (
            <div className="absolute left-0 mt-2 w-60 bg-card border border-border rounded-2xl shadow-xl p-4 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-3">
                <span className="text-xs font-bold text-foreground">Filter Categories</span>
                {selectedCategories.length > 0 && (
                  <button
                    onClick={() => setSelectedCategories([])}
                    className="text-[9px] font-bold text-orange-500 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {['Essentials', 'Growth', 'Stability', 'Rewards'].map(bucket => {
                  const isChecked = selectedCategories.includes(bucket)
                  return (
                    <label 
                      key={bucket} 
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition ${
                        isChecked 
                          ? 'bg-blue-500/10 border-blue-500/20 text-blue-500 font-semibold' 
                          : 'bg-background/50 border-border hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCategoryFilter(bucket)}
                        className="rounded border-border text-blue-500 focus:ring-blue-500 size-3"
                      />
                      <span>{bucket}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sort Select */}
        <div className="w-full sm:w-60">
          <CustomSelect
            value={sortOrder}
            onChange={(val) => setSortOrder(val)}
            options={[
              { value: 'amount-desc', label: 'Sort by: Amount (High to Low)' },
              { value: 'amount-asc', label: 'Sort by: Amount (Low to High)' },
              { value: 'name-asc', label: 'Sort by: Name (A-Z)' },
              { value: 'due-date', label: 'Sort by: Next Due Date' }
            ]}
            className="w-full"
          />
        </div>
      </div>

      {/* Subscriptions Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedPayments.map(rp => {
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
        
        {filteredAndSortedPayments.length === 0 && (
          <div className="p-12 text-center border border-dashed border-border rounded-2xl md:col-span-3 text-muted-foreground text-sm">
            {payments.length > 0 
              ? 'No subscriptions match your filter criteria.'
              : 'You don\'t have any subscription added yet. Click "New Subscription" above to create one.'
            }
          </div>
        )}
      </div>
    </div>
  )
}
