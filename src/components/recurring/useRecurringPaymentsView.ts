import React, { useState } from 'react'
import type { LedgerAccount, RecurringPayment, RecurringFrequency, RecurringPaymentMode, TransactionCategory } from '../../types'
import { maskCurrencyInput } from '../../lib/utils'
import { useSyncStatus } from '../../lib/useOptimisticList'
import { useAutoOpenModal } from '../../lib/useAutoOpenModal'
import { canOpenBlankMutationForm } from '../../lib/quickAddAvailability'
import { computeOccurrenceOnOrAfter, hasBillingEnded, normalizeRecurringFrequency } from '../../lib/recurringPayments'
import { financialDate } from '../../lib/financialDate'
import { formatSensitiveAmount, formatCurrencyAmount } from './formatters'
import { focusFirstInvalidField } from '../ui/formValidation'
import type { SensitivePreferenceStatus } from '../../app/useAppPreferences'
import { isRecurringLedgerCategory, type RecurringLedgerCategory } from '../../lib/ledgerCategories'

export type { RecurringLedgerCategory } from '../../lib/ledgerCategories'

// '' is the "not chosen yet" state of the add form's payment-mode select. There is deliberately no
// default: guessing wrong here silently offers Pay Early on a direct debit, or hides it from a bill
// the user does pay by hand, so the choice is made explicitly once per subscription.
export type RecurringPaymentModeSelection = RecurringPaymentMode | ''

function isRecurringPaymentMode(value: string): value is RecurringPaymentMode {
  return value === 'AutoDeduct' || value === 'Manual'
}

function nextDate(date: string): string {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + 1)
  return value.toLocaleDateString('en-CA')
}

export interface UseRecurringPaymentsViewOptions {
  payments: RecurringPayment[]
  accounts: LedgerAccount[]
  categories: TransactionCategory[]
  hideSensitive: boolean
  sensitivePreferenceStatus?: SensitivePreferenceStatus
  currency: string
  activeSyncId: string | null
  activeSyncIds?: ReadonlyArray<string>
  deletingId: string | null
  onAddPayment: (payment: Omit<RecurringPayment, 'id'>) => void
  onUpdatePayment: (id: string, payment: RecurringPayment) => void
  autoOpenAddForm?: boolean
  onResetAutoOpen?: () => void
  aiDraft?: { nonce: number; fields: Record<string, unknown> } | null
  aiEditDraft?: { nonce: number; id: string; changes: Record<string, unknown> } | null
  onAiDraftConsumed?: () => void
  onAiEditDraftConsumed?: () => void
}

export function useRecurringPaymentsView(options: UseRecurringPaymentsViewOptions) {
  const {
    payments,
    accounts,
    categories,
    hideSensitive,
    sensitivePreferenceStatus,
    currency,
    activeSyncId,
    activeSyncIds,
    deletingId,
    onAddPayment,
    onUpdatePayment,
    autoOpenAddForm,
    onResetAutoOpen,
    aiDraft = null,
    aiEditDraft = null,
    onAiDraftConsumed,
    onAiEditDraftConsumed,
  } = options

  const effectiveActiveSyncIds = activeSyncIds?.length ? activeSyncIds : activeSyncId
  const { isSyncing: isPaymentSyncing, isDeleting: isPaymentDeleting } = useSyncStatus(payments, effectiveActiveSyncIds, deletingId)
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
  const [frequency, setFrequency] = useState<RecurringFrequency>('Monthly')
  const [startDateInput, setStartDateInput] = useState('')
  const [endDateInput, setEndDateInput] = useState('')
  const [paymentMode, setPaymentMode] = useState<RecurringPaymentModeSelection>('')
  const [accountId, setAccountId] = useState('')

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
    const nextFrequency = getString('frequency')
    if (nextFrequency !== null) setFrequency(normalizeRecurringFrequency(nextFrequency))
    const nextStartDate = getString('startDate')
    if (nextStartDate !== null) setStartDateInput(nextStartDate)
    const nextEndDate = getString('endDate')
    if (nextEndDate !== null) setEndDateInput(nextEndDate)
    // A draft that names no mode (or an unrecognised one) leaves the select empty rather than
    // picking for the user -- the assistant does not know how the bill leaves the account.
    const nextPaymentMode = getString('paymentMode')
    if (nextPaymentMode && isRecurringPaymentMode(nextPaymentMode)) setPaymentMode(nextPaymentMode)
  }, [])

  React.useEffect(() => {
    if (!aiDraft) return
    if (hideSensitive) {
      onAiDraftConsumed?.()
      return
    }
    setEditingPayment(null)
    setName('')
    setAmount('')
    setCategory(categories.length > 0 ? categories[0].name : '')
    setLedgerCategory('Essentials')
    setFrequency('Monthly')
    setStartDateInput('')
    setEndDateInput('')
    setPaymentMode('')
    setAccountId('')
    applyAiRecurringFields(aiDraft.fields)
    setShowAddForm(true)
    onAiDraftConsumed?.()
  }, [aiDraft?.nonce, hideSensitive, onAiDraftConsumed])

  React.useEffect(() => {
    if (!hideSensitive || sensitivePreferenceStatus === 'pending') return
    setShowAddForm(false)
    setEditingPayment(null)
    setName('')
    setAmount('')
    setCategory(categories.length > 0 ? categories[0].name : '')
    setLedgerCategory('Essentials')
    setFrequency('Monthly')
    setStartDateInput('')
    setEndDateInput('')
    setPaymentMode('')
    setAccountId('')
    setErrors({})
  }, [hideSensitive, sensitivePreferenceStatus, categories])

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
    setFrequency(normalizeRecurringFrequency(payment.frequency))
    setStartDateInput(payment.startDate)
    setEndDateInput(payment.endDate || '')
    setPaymentMode(payment.paymentMode)
    setAccountId(payment.accountId)
    setEditingPayment(payment)
    applyAiRecurringFields(aiEditDraft.changes)
    setShowAddForm(true)
    onAiEditDraftConsumed?.()
  }, [aiEditDraft?.nonce])

  // Filter & Sorting state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sortOrder, setSortOrder] = useState<string>('amount-desc')
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)
  const filterButtonRef = React.useRef<HTMLButtonElement>(null)

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

  const clearCategoryFilters = () => setSelectedCategories([])

  // Click outside to close filter dropdown
  React.useEffect(() => {
    if (!isFilterDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.recurring-filter-dropdown, [data-floating-overlay]')) {
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
  useAutoOpenModal(autoOpenAddForm, () => {
    if (canOpenBlankMutationForm(hideSensitive, sensitivePreferenceStatus)) setShowAddForm(true)
  }, onResetAutoOpen)


  React.useEffect(() => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0].name)
    }
  }, [categories, category])

  // Only subscriptions that still bill count toward the committed total: an expired one keeps its
  // `active` flag (that toggle is the user's pause switch, not an expiry flag) but costs nothing.
  const totalCommittedMonthly = payments
    .filter(p => p.active && !hasBillingEnded(p))
    .reduce((acc, p) => acc + Math.abs(p.amount) / (normalizeRecurringFrequency(p.frequency) === 'Annually' ? 12 : 1), 0)

  const activeCount = payments.filter(p => p.active).length

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (hideSensitive || sensitivePreferenceStatus === 'pending') return

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
    if (!paymentMode) {
      newErrors.paymentMode = 'Choose whether this bill is auto deducted or paid manually.'
    }
    const matchingAccounts = accounts.filter(account => account.bucket === ledgerCategory && !account.isArchived)
    if (!accountId || !matchingAccounts.some(account => account.id === accountId)) {
      newErrors.accountId = 'Choose the account this bill is paid from.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      focusFirstInvalidField(e.currentTarget)
      return
    }
    // Reported above already; repeated here so the type narrows to a real mode rather than needing
    // a cast on the payload.
    if (!paymentMode) return
    setErrors({})

    // Parse the start date to extract the day of the month as DueDate
    // HTML date inputs are yyyy-MM-dd
    const dateParts = startDateInput.split('-')
    const parsedDueDay = dateParts.length === 3 ? Number.parseInt(dateParts[2], 10) : Number.NaN
    const dueDay = Number.isFinite(parsedDueDay) ? Math.min(31, Math.max(1, parsedDueDay)) : 1

    const schedule = {
      frequency,
      dueDate: dueDay,
      startDate: startDateInput,
      endDate: endDateInput || undefined,
    }
    const trackingStart = editingPayment ? nextDate(financialDate()) : financialDate()
    const paymentData = {
      name,
      amount: -Math.abs(parsedAmount), // Excel outlays are stored as negative
      frequency,
      category,
      ledgerCategory,
      nextDueDate: editingPayment?.active === false ? null : computeOccurrenceOnOrAfter(schedule, trackingStart),
      dueDate: dueDay,
      startDate: startDateInput,
      endDate: endDateInput || undefined,
      // Narrowed by the validation above: an empty selection never reaches here.
      paymentMode,
      accountId,
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
    setFrequency('Monthly')
    setCategory(categories.length > 0 ? categories[0].name : '')
    setPaymentMode('')
    setAccountId('')
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
    setFrequency('Monthly')
    setCategory(categories.length > 0 ? categories[0].name : '')
    setPaymentMode('')
    setAccountId('')
    setEditingPayment(null)
    setShowAddForm(false)
    setErrors({})
  }

  // Header "New Subscription"/"Cancel" toggle
  const toggleAddForm = () => {
    if (!canOpenBlankMutationForm(hideSensitive, sensitivePreferenceStatus)) return
    if (showAddForm) {
      handleCancelForm()
    } else {
      setShowAddForm(true)
    }
  }

  // Prefill the form from an existing payment (card Edit button)
  const beginEditPayment = (rp: RecurringPayment) => {
    if (hideSensitive) return
    setName(rp.name)
    setAmount(Math.abs(rp.amount).toFixed(2))
    setCategory(rp.category)
    setLedgerCategory(isRecurringLedgerCategory(rp.ledgerCategory) ? rp.ledgerCategory : 'Essentials')
    setFrequency(normalizeRecurringFrequency(rp.frequency))
    setStartDateInput(rp.startDate)
    setEndDateInput(rp.endDate || '')
    setPaymentMode(rp.paymentMode)
    setAccountId(rp.accountId)
    setEditingPayment(rp)
    setShowAddForm(true)
  }

  // Form field change handlers (each clears its own validation error)
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
    if (errors.name) {
      setErrors(prev => ({ ...prev, name: '' }))
    }
  }

  const handleAmountFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleAmountChange(e)
    if (errors.amount) {
      setErrors(prev => ({ ...prev, amount: '' }))
    }
  }

  const handlePaymentModeChange = (value: RecurringPaymentModeSelection) => {
    setPaymentMode(value)
    if (errors.paymentMode) {
      setErrors(prev => ({ ...prev, paymentMode: '' }))
    }
  }

  const handleLedgerCategoryChange = (value: RecurringLedgerCategory) => {
    setLedgerCategory(value)
    const matching = accounts.filter(account => account.bucket === value && !account.isArchived)
    setAccountId(matching.length === 1 ? matching[0].id : '')
    if (errors.accountId) setErrors(previous => ({ ...previous, accountId: '' }))
  }

  const handleStartDateChange = (value: string) => {
    setStartDateInput(value)
    if (errors.startDate) {
      setErrors(prev => ({ ...prev, startDate: '' }))
    }
  }

  const formatCurrency = React.useCallback(
    (val: number) => formatCurrencyAmount(val, currency),
    [currency]
  )

  const formatSensitive = React.useCallback(
    (val: number) => formatSensitiveAmount(val, hideSensitive, currency),
    [hideSensitive, currency]
  )

  return {
    // sync status
    isPaymentSyncing,
    isPaymentDeleting,
    // form state
    showAddForm,
    editingPayment,
    errors,
    name,
    amount,
    category,
    ledgerCategory,
    accountId,
    frequency,
    startDateInput,
    endDateInput,
    paymentMode,
    firstInputRef,
    // form handlers
    toggleAddForm,
    beginEditPayment,
    handleSubmit,
    handleCancelForm,
    handleNameChange,
    handleAmountFieldChange,
    handleStartDateChange,
    handlePaymentModeChange,
    setCategory,
    setLedgerCategory: handleLedgerCategoryChange,
    setAccountId,
    setFrequency,
    setEndDateInput,
    // filter & sort
    selectedCategories,
    sortOrder,
    setSortOrder,
    isFilterDropdownOpen,
    setIsFilterDropdownOpen,
    filterButtonRef,
    handleToggleCategoryFilter,
    clearCategoryFilters,
    filteredAndSortedPayments,
    // derived stats
    totalCommittedMonthly,
    activeCount,
    // formatters
    formatCurrency,
    formatSensitive,
  }
}
