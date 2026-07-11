import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { listContainerVariants, listItemVariants, listItemExit } from '../lib/animations'
import type { RecurringPayment, TransactionCategory, ActiveRecurringPayment, Transaction } from '../types'
import {
  Plus,
  Trash2,
  CreditCard,
  Calendar,
  Bell,
  X,
  Edit
} from 'lucide-react'
import { formatCurrencyVal, getCurrencySymbol, maskCurrencyInput } from '../lib/utils'
import { useSyncStatus } from '../lib/useOptimisticList'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { CustomSelect } from './ui/CustomSelect'
import { BottomSheet } from './ui/BottomSheet'
import { CycleSkeleton } from './ui/Skeleton'
import { RowSyncBadge } from './ui/RowSyncBadge'
import { ToggleButton } from './ui/ToggleButton'
import { SmartAmountInput } from './ui/SmartAmountInput'
import { BillTimeline } from './BillTimeline'
import { getCategoryBadgeClass, getCategoryDotClass, getCategoryFilterClass } from '../lib/categoryColors'
import { useAutoOpenModal } from '../lib/useAutoOpenModal'
import { useIsMobile } from '../lib/useIsMobile'
import { useAppContext } from '../contexts/AppContext'

const RECURRING_LEDGER_CATEGORIES = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const
type RecurringLedgerCategory = typeof RECURRING_LEDGER_CATEGORIES[number]

function isRecurringLedgerCategory(value: string): value is RecurringLedgerCategory {
  return (RECURRING_LEDGER_CATEGORIES as readonly string[]).includes(value)
}

interface RecurringPaymentsViewProps {
  payments: RecurringPayment[]
  activeRecurringPayments: ActiveRecurringPayment[]
  transactions?: Transaction[]
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  onAddPayment: (payment: Omit<RecurringPayment, 'id'>) => void
  onToggleActive: (id: string) => void
  onDeletePayment: (id: string) => void
  onUpdatePayment: (id: string, payment: RecurringPayment) => void
  hideSensitive?: boolean
  categories: TransactionCategory[]
  currency?: string
  autoOpenAddForm?: boolean
  onResetAutoOpen?: () => void
  isSwitchingCycle?: boolean
  activeSyncId?: string | null
  deletingId?: string | null
  aiDraft?: { nonce: number; fields: Record<string, unknown> } | null
  aiEditDraft?: { nonce: number; id: string; changes: Record<string, unknown> } | null
  onAiDraftConsumed?: () => void
  onAiEditDraftConsumed?: () => void
}

export const RecurringPaymentsView: React.FC<RecurringPaymentsViewProps> = ({
  payments,
  activeRecurringPayments,
  transactions = [],
  selectedMonth,
  selectedYear,
  cycleDay,
  onAddPayment,
  onToggleActive,
  onDeletePayment,
  onUpdatePayment,
  hideSensitive: hideSensitiveProp,
  categories,
  currency: currencyProp,
  autoOpenAddForm,
  onResetAutoOpen,
  isSwitchingCycle = false,
  activeSyncId: activeSyncIdProp,
  deletingId: deletingIdProp,
  aiDraft = null,
  aiEditDraft = null,
  onAiDraftConsumed,
  onAiEditDraftConsumed
}) => {
  const app = useAppContext()
  const hideSensitive = hideSensitiveProp ?? app.hideSensitive
  const currency = currencyProp ?? app.currency
  const activeSyncId = activeSyncIdProp ?? app.activeSyncId
  const deletingId = deletingIdProp ?? app.deletingId
  const isMobile = useIsMobile(640)
  const { isSyncing: isPaymentSyncing, isDeleting: isPaymentDeleting } = useSyncStatus(payments, activeSyncId, deletingId)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingPayment, setEditingPayment] = useState<RecurringPayment | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(maskCurrencyInput(e.target.value, amount));
  };
  const [ledgerCategory, setLedgerCategory] = useState<RecurringLedgerCategory>('Essentials')
  const [startDateInput, setStartDateInput] = useState('')
  const [endDateInput, setEndDateInput] = useState('')

  const firstInputRef = React.useRef<HTMLInputElement>(null)

  const applyAiRecurringFields = React.useCallback((fields: Record<string, unknown>) => {
    const getString = (key: string) => {
      const value = fields[key]
      return typeof value === 'string' && value.trim() ? value.trim() : null
    }
    const getNumber = (key: string) => {
      const value = fields[key]
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
      }
      return null
    }

    const nextName = getString('name')
    if (nextName !== null) setName(nextName)
    const nextAmount = getNumber('amount')
    if (nextAmount !== null) setAmount(Math.abs(nextAmount).toFixed(2))
    const nextCategory = getString('category')
    if (nextCategory !== null) setCategory(nextCategory)
    const nextLedgerCategory = getString('ledgerCategory')
    if (nextLedgerCategory && isRecurringLedgerCategory(nextLedgerCategory)) setLedgerCategory(nextLedgerCategory)
    const nextStartDate = getString('startDate')
    if (nextStartDate !== null) setStartDateInput(nextStartDate)
    const nextEndDate = getString('endDate')
    if (nextEndDate !== null) setEndDateInput(nextEndDate)
  }, [])

  React.useEffect(() => {
    if (!aiDraft) return
    setEditingPayment(null)
    setName('')
    setAmount('')
    setCategory(categories.length > 0 ? categories[0].name : '')
    setLedgerCategory('Essentials')
    setStartDateInput('')
    setEndDateInput('')
    applyAiRecurringFields(aiDraft.fields)
    setShowAddForm(true)
    onAiDraftConsumed?.()
  }, [aiDraft?.nonce])

  React.useEffect(() => {
    if (!aiEditDraft) return
    if (hideSensitive) {
      onAiEditDraftConsumed?.()
      return
    }
    const payment = payments.find(p => String(p.id) === String(aiEditDraft.id))
    if (!payment) {
      onAiEditDraftConsumed?.()
      return
    }
    setName(payment.name)
    setAmount(Math.abs(payment.amount).toFixed(2))
    setCategory(payment.category)
    setLedgerCategory(isRecurringLedgerCategory(payment.ledgerCategory) ? payment.ledgerCategory : 'Essentials')
    setStartDateInput(payment.startDate)
    setEndDateInput(payment.endDate || '')
    setEditingPayment(payment)
    applyAiRecurringFields(aiEditDraft.changes)
    setShowAddForm(true)
    onAiEditDraftConsumed?.()
  }, [aiEditDraft?.nonce])

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

  // Deferred so the sheet's entrance animation doesn't start on the contended
  // tab-switch/mount frame (which made the slide occasionally skip). See
  // lib/useAutoOpenModal.
  useAutoOpenModal(autoOpenAddForm, () => setShowAddForm(true), onResetAutoOpen)


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
    if (hideSensitive && editingPayment) return

    const newErrors: Record<string, string> = {}
    if (!name.trim()) {
      newErrors.name = 'Subscription name is required.'
    }
    const parsedAmount = parseFloat(amount)
    if (!amount.trim()) {
      newErrors.amount = 'Billing amount is required.'
    } else if (isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = 'Please enter a valid amount greater than 0.'
    }
    if (!startDateInput) {
      newErrors.startDate = 'Start billing date is required.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    
    // Parse the start date to extract the day of the month as DueDate
    // HTML date inputs are yyyy-MM-dd
    const dateParts = startDateInput.split('-')
    const dueDay = dateParts.length === 3 ? parseInt(dateParts[2]) : 15

    const paymentData = {
      name,
      amount: -Math.abs(parsedAmount), // Excel outlays are stored as negative
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
    setCategory(categories.length > 0 ? categories[0].name : '')
    setEditingPayment(null)
    setShowAddForm(false)
    setErrors({})
  }

  const handleCancelForm = () => {
    setName('')
    setAmount('')
    setStartDateInput('')
    setEndDateInput('')
    setLedgerCategory('Essentials')
    setCategory(categories.length > 0 ? categories[0].name : '')
    setEditingPayment(null)
    setShowAddForm(false)
    setErrors({})
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



  if (isSwitchingCycle) {
    return <CycleSkeleton variant="recurring" />
  }

  return (
    <div className="space-y-6 soft-rise">
      
      {/* Header section with Stats */}
      <div className="w-full">
        <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              if (showAddForm) {
                handleCancelForm()
              } else {
                setShowAddForm(true)
              }
            }}
            className="rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 duration-200 self-start md:self-center"
          >
            {showAddForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showAddForm ? 'Cancel' : 'New Subscription'}
          </Button>
        </Card>
      </div>

      {/* Visual Bill Timeline */}
      <div className="space-y-4">
        <BillTimeline
          title="Subscriptions Billing Timeline"
          cycleOffset={0}
          activeRecurringPayments={activeRecurringPayments}
          allPayments={payments}
          transactions={transactions}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          cycleDay={cycleDay}
          currency={currency}
          hideSensitive={hideSensitive}
        />
      </div>

      {/* Add / Edit Subscription Modal (bottom sheet on mobile) */}
      {showAddForm && (
        <BottomSheet
          isOpen={showAddForm}
          onClose={handleCancelForm}
          maxWidthClassName="max-w-xl"
          title={
            <span className="flex items-center gap-2">
              {editingPayment ? <Edit className="size-4 text-blue-500" /> : <Plus className="size-4 text-blue-500" />}
              {editingPayment ? 'Edit Subscription' : 'Add New Recurring Payment'}
            </span>
          }
        >
          <form noValidate onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Subscription Name</label>
              <input
                ref={firstInputRef}
                type="text"
                placeholder="e.g. Netflix, Spotify"
                value={name}
                onChange={e => {
                  setName(e.target.value)
                  if (errors.name) {
                    setErrors(prev => ({ ...prev, name: '' }))
                  }
                }}
                className={`w-full px-3.5 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
                  errors.name 
                    ? 'border-destructive focus:ring-destructive' 
                    : 'border-border focus:ring-blue-500'
                }`}
              />
              {errors.name && (
                <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Billing Amount ({getCurrencySymbol(currency)})</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 z-10 text-xs font-semibold text-muted-foreground pointer-events-none select-none">
                  {getCurrencySymbol(currency)}
                </span>
                <SmartAmountInput
                  type="text"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => {
                    handleAmountChange(e)
                    if (errors.amount) {
                      setErrors(prev => ({ ...prev, amount: '' }))
                    }
                  }}
                  className={`w-full pr-3.5 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
                    getCurrencySymbol(currency).length > 2 ? 'pl-11' : getCurrencySymbol(currency).length > 1 ? 'pl-9' : 'pl-7'
                  } ${
                    errors.amount 
                      ? 'border-destructive focus:ring-destructive' 
                      : 'border-border focus:ring-blue-500'
                  }`}
                />
              </div>
              {errors.amount && (
                <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  {errors.amount}
                </p>
              )}
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
                value={startDateInput}
                onChange={e => {
                  setStartDateInput(e.target.value)
                  if (errors.startDate) {
                    setErrors(prev => ({ ...prev, startDate: '' }))
                  }
                }}
                className={`w-full px-3.5 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
                  errors.startDate 
                    ? 'border-destructive focus:ring-destructive' 
                    : 'border-border focus:ring-blue-500'
                }`}
              />
              {errors.startDate && (
                <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  {errors.startDate}
                </p>
              )}
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

            <div className="sm:col-span-2 flex gap-2 justify-end border-t border-border/30 pt-4 mt-1">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted text-foreground transition cursor-pointer"
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition cursor-pointer"
              >
                {editingPayment ? 'Save Changes' : 'Add Subscription'}
              </motion.button>
            </div>
          </form>
        </BottomSheet>
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
            <span className="text-[9px] text-muted-foreground">{'▼'}</span>
          </button>

          {/* Desktop Filter Popover */}
          {isFilterDropdownOpen && (
            <div className="hidden sm:block absolute left-0 mt-2 w-60 bg-card border border-border rounded-2xl shadow-xl p-4 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
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
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition ${getCategoryFilterClass(bucket, isChecked)}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCategoryFilter(bucket)}
                        className="rounded border-border text-blue-500 focus:ring-blue-500 size-3"
                      />
                      <span className={`size-2 rounded-full ${getCategoryDotClass(bucket)}`} />
                      <span>{bucket}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Mobile BottomSheet Filter */}
          {isMobile && (
            <BottomSheet
              isOpen={isFilterDropdownOpen}
              title="Filter Categories"
              onClose={() => setIsFilterDropdownOpen(false)}
            >
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {selectedCategories.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setSelectedCategories([])}
                      className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2">
                  {['Essentials', 'Growth', 'Stability', 'Rewards'].map(bucket => {
                    const isChecked = selectedCategories.includes(bucket)
                    return (
                      <label 
                        key={bucket} 
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs cursor-pointer select-none transition ${getCategoryFilterClass(bucket, isChecked)}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCategoryFilter(bucket)}
                          className="rounded border-border text-blue-500 focus:ring-blue-500 size-3.5"
                        />
                        <span className={`size-2.5 rounded-full ${getCategoryDotClass(bucket)}`} />
                        <span className="font-semibold">{bucket}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </BottomSheet>
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
      <motion.div
        initial="hidden" animate="show"
        variants={listContainerVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        <AnimatePresence>
        {filteredAndSortedPayments.map(rp => {
          const isBusy = isPaymentDeleting(rp.id) || isPaymentSyncing(rp.id) || rp.isPendingSync
          return (
            <motion.div
              key={rp.id}
              variants={listItemVariants}
              exit={listItemExit}
              className={`p-6 rounded-2xl bg-card border transition-all duration-300 flex flex-col justify-between ${
                rp.active
                  ? 'border-border/60 hover:border-blue-500/30 shadow-xs'
                  : 'border-dashed border-border/60 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                      {rp.name}
                      {!rp.active && (
                        <span className="text-[9px] font-semibold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Paused</span>
                      )}
                      {isPaymentDeleting(rp.id) ? (
                        <RowSyncBadge state="deleting" entityLabel="subscription" />
                      ) : (isPaymentSyncing(rp.id) || rp.isPendingSync) ? (
                        <RowSyncBadge state={isPaymentSyncing(rp.id) ? 'syncing' : 'pending'} entityLabel="subscription" />
                      ) : null}
                    </h3>
                    <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 font-semibold rounded border ${getCategoryBadgeClass(rp.category)}`}>
                      {rp.category}
                    </span>
                  </div>
                  
                  {/* Status Toggle Button */}
                  <ToggleButton
                    active={rp.active}
                    onClick={() => onToggleActive(rp.id)}
                    disabled={isBusy || hideSensitive}
                  />
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
                    <span className={`inline-block px-1.5 py-0.5 rounded-md border font-semibold ${getCategoryBadgeClass(rp.ledgerCategory)}`}>
                      {rp.ledgerCategory}
                    </span>
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

              <div className="mt-6 flex items-center justify-between border-t border-border/30 pt-4 gap-2">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                  <Bell className="size-3 text-blue-500" /> Auto-notify
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (hideSensitive) return
                      setName(rp.name)
                      setAmount(Math.abs(rp.amount).toFixed(2))
                      setCategory(rp.category)
                      setLedgerCategory(isRecurringLedgerCategory(rp.ledgerCategory) ? rp.ledgerCategory : 'Essentials')
                      setStartDateInput(rp.startDate)
                      setEndDateInput(rp.endDate || '')
                      setEditingPayment(rp)
                      setShowAddForm(true)
                    }}
                    disabled={isBusy || hideSensitive}
                    title={hideSensitive ? 'Unhide balances to edit' : 'Edit subscription'}
                  >
                    <Edit className="size-3.5" /> Edit
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => { if (!hideSensitive) onDeletePayment(rp.id) }}
                    disabled={isBusy || hideSensitive}
                    title={hideSensitive ? 'Unhide balances to edit' : 'Delete subscription'}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          )
        })}
        </AnimatePresence>

        {filteredAndSortedPayments.length === 0 && (
          <div className="p-12 text-center border border-dashed border-border rounded-2xl md:col-span-3 text-muted-foreground text-sm">
            {payments.length > 0
              ? 'No subscriptions match your filter criteria.'
              : 'You don\'t have any subscription added yet. Click "New Subscription" above to create one.'
            }
          </div>
        )}
      </motion.div>
    </div>
  )
}
