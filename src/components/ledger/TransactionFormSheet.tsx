import React, { useState, useMemo, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Transaction, TransactionCategory, AutocompleteSuggestion } from '../../types'
import {
  startReceiptScan,
  suggestTransactionCategories,
  suggestTransactionNotes,
  type CategorySuggestion,
  type ReceiptScanResult,
  type TransactionNoteSuggestion,
} from '../../lib/api'
import {
  PlusCircle,
  MinusCircle,
  RefreshCw,
  AlertCircle,
  Loader2,
  Camera,
  Image,
  CheckCircle2,
  Sparkles,
  X,
} from 'lucide-react'
import { CustomSelect } from '../ui/CustomSelect'
import { SearchableSelect } from '../ui/SearchableSelect'
import { BottomSheet } from '../ui/BottomSheet'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { PerimeterBeam } from '../ui/PerimeterBeam'
import { getCurrencySymbol, maskCurrencyInput } from '../../lib/utils'
import { getErrorMessage } from '../../lib/errors'
import { useFormDraft } from '../../lib/useFormDraft'
import { useAutoOpenModal } from '../../lib/useAutoOpenModal'
import { computeIncomeLedgerCategory } from '../../lib/incomeSplit'

const TRANSFER_BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const
type TransferBucket = typeof TRANSFER_BUCKETS[number]
const SELECTABLE_LEDGER_CATEGORIES = ['Income', ...TRANSFER_BUCKETS] as const
type SelectableLedgerCategory = typeof SELECTABLE_LEDGER_CATEGORIES[number]

function isTransferBucket(value: string): value is TransferBucket {
  return (TRANSFER_BUCKETS as readonly string[]).includes(value)
}
function isSelectableLedgerCategory(value: string): value is SelectableLedgerCategory {
  return (SELECTABLE_LEDGER_CATEGORIES as readonly string[]).includes(value)
}

// Imperative handle the parent (LedgerView) drives from row clicks and the
// header button, so the form owns all its own state without lifting ~30
// fields up into the parent.
export interface TransactionFormHandle {
  open: () => void
  close: () => void
  startEdit: (t: Transaction) => void
}

export interface TransactionFormSheetProps {
  categories: TransactionCategory[]
  currency: string
  hideSensitive: boolean
  autocompleteSuggestions: AutocompleteSuggestion[]
  transactions: Transaction[]
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
  stabilityBalance: number
  stabilityTarget: number
  stabilityOverflowRedirect: string
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void> | void
  onUpdateTransaction?: (id: string, transaction: Omit<Transaction, 'id'>) => Promise<void> | void
  onStartEditPending?: (id: string | null) => void
  onAddFormOpenChange?: (open: boolean) => void
  autoOpenAddForm?: boolean
  onResetAutoOpen?: () => void
  receiptScanDraft?: { jobId: string; result: ReceiptScanResult } | null
  onReceiptScanStarted?: (scanId: string) => void
  onReceiptScanCleared?: (scanId: string) => void | Promise<void>
  activeScanJobIds?: string[]
  failedScanJob?: { jobId: string; errorMessage: string } | null
  aiDraft?: { nonce: number; fields: Record<string, unknown> } | null
  aiEditDraft?: { nonce: number; id: string; changes: Record<string, unknown> } | null
  onAiDraftConsumed?: () => void
  onAiEditDraftConsumed?: () => void
  onFetchTransactionById?: (id: string) => Promise<Transaction>
  onShowAlert?: (message: string, title?: string) => void
}

const getTodayDateString = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const TransactionFormSheet = forwardRef<TransactionFormHandle, TransactionFormSheetProps>(function TransactionFormSheet({
  categories,
  currency,
  hideSensitive,
  autocompleteSuggestions,
  transactions,
  essentialsAlloc,
  growthAlloc,
  stabilityAlloc,
  rewardsAlloc,
  stabilityBalance,
  stabilityTarget,
  stabilityOverflowRedirect,
  onAddTransaction,
  onUpdateTransaction,
  onStartEditPending,
  onAddFormOpenChange,
  autoOpenAddForm,
  onResetAutoOpen,
  receiptScanDraft = null,
  onReceiptScanStarted,
  onReceiptScanCleared,
  activeScanJobIds = [],
  failedScanJob = null,
  aiDraft = null,
  aiEditDraft = null,
  onAiDraftConsumed,
  onAiEditDraftConsumed,
  onFetchTransactionById,
  onShowAlert,
}, ref) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [txType, setTxType] = useState<'inflow' | 'outflow' | 'transfer'>('outflow')
  const [category, setCategory] = useState('')
  const [ledgerCategory, setLedgerCategory] = useState<SelectableLedgerCategory>('Essentials')
  const [transferSource, setTransferSource] = useState<TransferBucket>('Essentials')
  const [transferTarget, setTransferTarget] = useState<TransferBucket>('Rewards')
  const [date, setDate] = useState(getTodayDateString)

  const [editingTxId, setEditingTxId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // OCR scan state
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [showScanBanner, setShowScanBanner] = useState(false)
  const [activeReceiptScanJobId, setActiveReceiptScanJobId] = useState<string | null>(null)
  const [showScanPicker, setShowScanPicker] = useState(false)
  const scanFileInputRef = useRef<HTMLInputElement>(null)
  const scanGalleryInputRef = useRef<HTMLInputElement>(null)
  const appliedReceiptScanJobRef = useRef<string | null>(null)
  const locallyStartedReceiptScanJobsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    onAddFormOpenChange?.(showAddForm)
    return () => {
      onAddFormOpenChange?.(false)
    }
  }, [showAddForm, onAddFormOpenChange])

  // Open the add/edit sheet synchronously, straight from the click handler,
  // rather than deferring the state update into a requestAnimationFrame. A
  // discrete click flushes the mount synchronously, which keeps the shared
  // BottomSheet's entrance slide in step with framer's animation clock; a
  // rAF-deferred open pushed the mount onto React's concurrent scheduler and
  // made the slide play only intermittently. This also just mirrors how the
  // recurring-payments modal (which never had the issue) opens its sheet.
  const openTransactionForm = useCallback(() => {
    setShowAddForm(true)
  }, [])

  // Keep the in-progress add/edit form across an interrupted session (see
  // useFormDraft) -- reopens with exactly what the user had typed.
  const { clearDraft: clearFormDraft } = useFormDraft(
    'ledger-tx-form',
    showAddForm,
    { editingTxId, description, amount, txType, category, ledgerCategory, transferSource, transferTarget, date },
    (draft) => {
      setEditingTxId(draft.editingTxId)
      setDescription(draft.description)
      setAmount(draft.amount)
      setTxType(draft.txType)
      setCategory(draft.category)
      setLedgerCategory(draft.ledgerCategory)
      setTransferSource(draft.transferSource)
      setTransferTarget(draft.transferTarget)
      setDate(draft.date)
      if (draft.editingTxId && onStartEditPending) {
        onStartEditPending(draft.editingTxId)
      }
      openTransactionForm()
    }
  )

  const firstInputRef = React.useRef<HTMLInputElement>(null)

  const applyReceiptScanResult = useCallback((result: ReceiptScanResult) => {
    if (result.description) setDescription(result.description)
    if (result.amount != null && result.amount > 0) setAmount(result.amount.toFixed(2))

    if (result.date) {
      setDate(result.date)
    } else {
      const now = new Date()
      const y = now.getFullYear()
      const mo = String(now.getMonth() + 1).padStart(2, '0')
      const d = String(now.getDate()).padStart(2, '0')
      setDate(`${y}-${mo}-${d}`)
    }

    setTxType(result.txType === 'inflow' || result.txType === 'outflow' ? result.txType : 'outflow')

    if (result.ledgerCategory && isSelectableLedgerCategory(result.ledgerCategory)) {
      setLedgerCategory(result.ledgerCategory)
    }

    if (result.category) {
      const matched = categories.find(c => c.name.toLowerCase() === result.category.toLowerCase())
      if (matched) setCategory(matched.name)
    }

    setShowScanBanner(true)
    setErrors({})

    window.setTimeout(() => {
      firstInputRef.current?.focus()
      firstInputRef.current?.select()
    }, 450)
  }, [categories])

  useEffect(() => {
    if (!receiptScanDraft) return
    if (appliedReceiptScanJobRef.current === receiptScanDraft.jobId) return

    const isLocallyStarted = locallyStartedReceiptScanJobsRef.current.has(receiptScanDraft.jobId)

    // If it's not locally started, and the modal is not open, we should wait for auto-open
    if (!showAddForm && !isLocallyStarted && !autoOpenAddForm) {
      return
    }

    // If it is open but not locally started, and not auto-opened, we don't want to overwrite
    if (showAddForm && !isLocallyStarted && !autoOpenAddForm) {
      return
    }

    appliedReceiptScanJobRef.current = receiptScanDraft.jobId
    setActiveReceiptScanJobId(null)
    setIsScanning(false)
    setEditingTxId(null)
    if (onStartEditPending) {
      onStartEditPending(null)
    }
    openTransactionForm()
    applyReceiptScanResult(receiptScanDraft.result)
  }, [receiptScanDraft, showAddForm, autoOpenAddForm, openTransactionForm, applyReceiptScanResult, onStartEditPending])

  // Handle the file selected from the native camera/gallery picker
  const handleScanReceipt = useCallback(async (file: File) => {
    setIsScanning(true)
    setScanError(null)
    setShowScanBanner(false)
    // Reset the applied ref so a fresh scan on the same session can be applied
    appliedReceiptScanJobRef.current = null
    try {
      const started = await startReceiptScan(file)
      locallyStartedReceiptScanJobsRef.current.add(started.scanId)
      onReceiptScanStarted?.(started.scanId)
      setActiveReceiptScanJobId(started.scanId)
      setShowScanBanner(false)
    } catch (err: unknown) {
      setScanError(getErrorMessage(err, 'Could not read the receipt. Please try a clearer photo.'))
      setIsScanning(false)
    } finally {
      // Reset file inputs so the same file can be selected again if needed
      if (scanFileInputRef.current) scanFileInputRef.current.value = ''
      if (scanGalleryInputRef.current) scanGalleryInputRef.current.value = ''
    }
  }, [onReceiptScanStarted])

  useEffect(() => {
    if (!activeReceiptScanJobId) return

    // If the job failed, show the error and stop spinning
    if (failedScanJob && failedScanJob.jobId === activeReceiptScanJobId) {
      setScanError(failedScanJob.errorMessage)
      setIsScanning(false)
      setActiveReceiptScanJobId(null)
      return
    }

    // Job no longer being polled and hasn't been applied yet — stop spinner (cleared/cancelled)
    if (!activeScanJobIds.includes(activeReceiptScanJobId)) {
      setIsScanning(false)
      setActiveReceiptScanJobId(null)
    }
  }, [activeReceiptScanJobId, activeScanJobIds, failedScanJob])

  // Autocomplete suggestion state
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [categorySuggestions, setCategorySuggestions] = useState<CategorySuggestion[]>([])
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false)
  const [categorySuggestionUnavailable, setCategorySuggestionUnavailable] = useState(false)
  const [noteSuggestions, setNoteSuggestions] = useState<TransactionNoteSuggestion[]>([])
  const [showNoteSuggestions, setShowNoteSuggestions] = useState(false)
  const [isSuggestingNote, setIsSuggestingNote] = useState(false)
  const [noteSuggestionUnavailable, setNoteSuggestionUnavailable] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const descriptionRef = useRef('')
  const autocompletedDescriptionRef = useRef<string | null>(null)
  const categorySuggestionAbortRef = useRef<AbortController | null>(null)
  const categorySuggestionRequestSeqRef = useRef(0)
  const lastCategorySuggestionKeyRef = useRef<string | null>(null)
  const noteSuggestionAbortRef = useRef<AbortController | null>(null)
  const noteSuggestionRequestSeqRef = useRef(0)

  useEffect(() => {
    descriptionRef.current = description
  }, [description])

  // Build unique suggestion entries from past transactions (most recent first, deduped by description)
  const activeSuggestionEntries = useMemo(() => {
    if (txType === 'transfer') return []
    return autocompleteSuggestions.filter(s =>
      s.txType === txType && !s.ledgerCategory.toLowerCase().startsWith('transfer:income->')
    )
  }, [autocompleteSuggestions, txType])

  // Filter suggestions based on current description input
  const filteredSuggestions = useMemo(() => {
    if (!description.trim() || description.trim().length < 1) return []
    const query = description.toLowerCase().trim()
    return activeSuggestionEntries
      .filter(s => s.description.toLowerCase().includes(query))
      .slice(0, 8) // Limit to 8 suggestions
  }, [description, activeSuggestionEntries])

  const quickSuggestionEntries = useMemo(() => {
    return activeSuggestionEntries.slice(0, 12)
  }, [activeSuggestionEntries])

  const handleQuickSuggestionsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
    el.scrollLeft += e.deltaY
    e.preventDefault()
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    if (!showSuggestions && !showNoteSuggestions) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.description-autocomplete')) {
        setShowSuggestions(false)
        setShowNoteSuggestions(false)
        setSelectedSuggestionIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showSuggestions, showNoteSuggestions])

  const handleSelectSuggestion = (suggestion: { description: string; category: string; ledgerCategory: string; txType?: 'inflow' | 'outflow' }) => {
    descriptionRef.current = suggestion.description
    autocompletedDescriptionRef.current = suggestion.description.trim()
    setDescription(suggestion.description)
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    setCategorySuggestions([])
    setCategorySuggestionUnavailable(false)
    setNoteSuggestionUnavailable(false)
    setNoteSuggestions([])
    setShowNoteSuggestions(false)
    setIsSuggestingCategory(false)
    lastCategorySuggestionKeyRef.current = null
    categorySuggestionAbortRef.current?.abort()
    noteSuggestionAbortRef.current?.abort()
    setIsSuggestingNote(false)

    // Auto-fill category and ledger category (only if not editing and not in transfer mode)
    if (txType !== 'transfer') {
      if (isSelectableLedgerCategory(suggestion.ledgerCategory)) {
        setLedgerCategory(suggestion.ledgerCategory)
        // Sync txType based on suggestion's ledger category
        if (suggestion.txType && suggestion.txType !== txType) return
      }
      if (suggestion.category) {
        setCategory(suggestion.category)
      }
    }
  }

  const requestCategorySuggestions = useCallback(async (rawDescription: string) => {
    const trimmedDescription = rawDescription.trim()
    const normalizedAutocompleted = autocompletedDescriptionRef.current?.trim()

    if (
      !showAddForm ||
      editingTxId ||
      txType === 'transfer' ||
      trimmedDescription.length < 2 ||
      categories.length === 0 ||
      (normalizedAutocompleted && normalizedAutocompleted === trimmedDescription)
    ) {
      return
    }

    const categoryNames = categories.map(c => c.name).filter(Boolean)
    const requestKey = JSON.stringify([trimmedDescription.toLowerCase(), txType, categoryNames])
    if (lastCategorySuggestionKeyRef.current === requestKey) return
    lastCategorySuggestionKeyRef.current = requestKey

    categorySuggestionAbortRef.current?.abort()
    const controller = new AbortController()
    categorySuggestionAbortRef.current = controller
    const requestSeq = categorySuggestionRequestSeqRef.current + 1
    categorySuggestionRequestSeqRef.current = requestSeq
    setIsSuggestingCategory(true)
    setCategorySuggestionUnavailable(false)

    try {
      const suggestions = await suggestTransactionCategories({
        description: trimmedDescription,
        txType,
        categories: categoryNames,
      }, controller.signal)

      if (categorySuggestionRequestSeqRef.current !== requestSeq) return
      setCategorySuggestions(suggestions)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (categorySuggestionRequestSeqRef.current === requestSeq) {
        setCategorySuggestions([])
        setCategorySuggestionUnavailable(true)
        lastCategorySuggestionKeyRef.current = null
      }
      console.warn('Failed to suggest transaction categories', err)
    } finally {
      if (categorySuggestionRequestSeqRef.current === requestSeq) {
        setIsSuggestingCategory(false)
      }
    }
  }, [categories, editingTxId, showAddForm, txType])

  const requestNoteSuggestions = useCallback(async () => {
    const trimmedDescription = descriptionRef.current.trim()
    if (!showAddForm || txType === 'transfer' || trimmedDescription.length < 2) return

    noteSuggestionAbortRef.current?.abort()
    const controller = new AbortController()
    noteSuggestionAbortRef.current = controller
    const requestSeq = noteSuggestionRequestSeqRef.current + 1
    noteSuggestionRequestSeqRef.current = requestSeq

    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    setShowNoteSuggestions(true)
    setIsSuggestingNote(true)
    setNoteSuggestionUnavailable(false)

    try {
      const suggestions = await suggestTransactionNotes({
        description: trimmedDescription,
        category,
        ledgerCategory,
        txType,
        // Keep within the API's history limits (<=10 entries, each non-blank and
        // <=150 chars) so the request isn't rejected before it reaches the model.
        historyDescriptions: activeSuggestionEntries
          .map(s => s.description?.trim())
          .filter((d): d is string => !!d)
          .map(d => d.length > 150 ? d.slice(0, 150) : d)
          .slice(0, 10)
      }, controller.signal)

      if (noteSuggestionRequestSeqRef.current !== requestSeq) return
      setNoteSuggestions(suggestions)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (noteSuggestionRequestSeqRef.current === requestSeq) {
        setNoteSuggestions([])
        setNoteSuggestionUnavailable(true)
      }
      console.warn('Failed to suggest transaction notes', err)
    } finally {
      if (noteSuggestionRequestSeqRef.current === requestSeq) {
        setIsSuggestingNote(false)
      }
    }
  }, [activeSuggestionEntries, category, ledgerCategory, showAddForm, txType])

  const handleSelectNoteSuggestion = (suggestion: TransactionNoteSuggestion) => {
    descriptionRef.current = suggestion.note
    autocompletedDescriptionRef.current = null
    setDescription(suggestion.note)
    setShowNoteSuggestions(false)
    setNoteSuggestions([])
    if (errors.description) {
      setErrors(prev => ({ ...prev, description: '' }))
    }
  }

  const handleDescriptionBlur = () => {
    window.setTimeout(() => {
      setShowSuggestions(false)
      void requestCategorySuggestions(descriptionRef.current)
    }, 220)
  }

  const handleChangeTxType = (nextType: 'inflow' | 'outflow' | 'transfer') => {
    if (nextType === txType) return
    setTxType(nextType)
    if (!editingTxId) {
      setDescription('')
      descriptionRef.current = ''
      autocompletedDescriptionRef.current = null
      setCategorySuggestions([])
      setCategorySuggestionUnavailable(false)
      setNoteSuggestionUnavailable(false)
      setNoteSuggestions([])
      setShowNoteSuggestions(false)
      setIsSuggestingCategory(false)
      categorySuggestionAbortRef.current?.abort()
      noteSuggestionAbortRef.current?.abort()
      setIsSuggestingNote(false)
      lastCategorySuggestionKeyRef.current = null
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    }
    // Always re-derive category/ledgerCategory for the new type, even while
    // editing — otherwise a stale value left over from whatever type the
    // transaction started as (or from a previous form session, for transfers
    // which never set these fields at all) gets silently submitted.
    if (nextType === 'transfer') {
      setCategory('Transfer')
    } else if (categories.length > 0) {
      const fallbackCategory = nextType === 'inflow' && categories.some(c => c.name === 'Salary')
        ? 'Salary'
        : categories[0].name
      setCategory(fallbackCategory)
    }
  }

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredSuggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => Math.min(prev + 1, filteredSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault()
      handleSelectSuggestion(filteredSuggestions[selectedSuggestionIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    }
  }

  // Scroll the selected suggestion into view
  useEffect(() => {
    if (selectedSuggestionIndex >= 0 && suggestionsRef.current) {
      const items = suggestionsRef.current.querySelectorAll('[data-suggestion]')
      if (items[selectedSuggestionIndex]) {
        items[selectedSuggestionIndex].scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedSuggestionIndex])

  useEffect(() => {
    return () => {
      categorySuggestionAbortRef.current?.abort()
      noteSuggestionAbortRef.current?.abort()
    }
  }, [])

  const categorySelectOptions = useMemo(() => {
    const categoryByName = new Map(categories.map(c => [c.name.toLowerCase(), c.name]))
    const suggestedNames = new Set<string>()
    const suggestedOptions = categorySuggestions
      .map(s => {
        const canonicalName = categoryByName.get(s.category.toLowerCase())
        if (!canonicalName || suggestedNames.has(canonicalName.toLowerCase())) return null
        suggestedNames.add(canonicalName.toLowerCase())
        const confidence = Number.isFinite(s.confidence)
          ? Math.max(0, Math.min(100, Math.round(s.confidence * 100)))
          : null
        return {
          value: canonicalName,
          label: canonicalName,
          badge: confidence == null ? 'Suggested' : `Suggested ${confidence}%`,
        }
      })
      .filter((option): option is { value: string; label: string; badge: string } => option !== null)

    const remainingOptions = categories
      .filter(c => !suggestedNames.has(c.name.toLowerCase()))
      .map(c => ({ value: c.name, label: c.name }))

    return [...suggestedOptions, ...remainingOptions]
  }, [categories, categorySuggestions])

  // Deferred so the sheet's entrance animation doesn't start on the contended
  // tab-switch/mount frame (which made the slide occasionally skip). See
  // lib/useAutoOpenModal.
  useAutoOpenModal(autoOpenAddForm, openTransactionForm, onResetAutoOpen)

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(maskCurrencyInput(e.target.value, amount));
  };

  const handleStartEdit = (t: Transaction) => {
    if (hideSensitive) return
    setEditingTxId(t.id)
    descriptionRef.current = t.description
    autocompletedDescriptionRef.current = null
    setCategorySuggestions([])
    setIsSuggestingCategory(false)
    categorySuggestionAbortRef.current?.abort()
    lastCategorySuggestionKeyRef.current = null
    setDescription(t.description)
    setAmount(Math.abs(t.amount).toFixed(2))
    setDate(t.date)
    if (onStartEditPending) {
      onStartEditPending(t.id)
    }
    if ((t.ledgerCategory || '').startsWith('Transfer:')) {
      setTxType('transfer')
      // Transfers don't use category/ledgerCategory directly, but these must
      // still hold a well-defined value in case the user switches the type
      // away from Transfer mid-edit (see the type-change effect below).
      setCategory(t.category || 'Transfer')
      setLedgerCategory('Essentials')
      const parts = t.ledgerCategory.substring(9).split('->')
      if (parts.length === 2) {
        const source = parts[0].trim()
        const target = parts[1].trim()
        if (isTransferBucket(source)) setTransferSource(source)
        if (isTransferBucket(target)) setTransferTarget(target)
      }
    } else {
      if (t.amount < 0) {
        setTxType('outflow')
      } else {
        setTxType('inflow')
      }
      setCategory(t.category)
      if ((t.ledgerCategory || '').startsWith('IncomeSplit:')) {
        setLedgerCategory('Income')
      } else {
        if (isSelectableLedgerCategory(t.ledgerCategory)) {
          setLedgerCategory(t.ledgerCategory)
        }
      }
    }
    openTransactionForm()
  }

  const applyAiLedgerFields = useCallback((fields: Record<string, unknown>) => {
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

    const nextDescription = getString('description')
    if (nextDescription !== null) setDescription(nextDescription)
    const nextAmount = getNumber('amount')
    if (nextAmount !== null) setAmount(Math.abs(nextAmount).toFixed(2))
    const nextDate = getString('date')
    if (nextDate !== null) setDate(nextDate)
    const nextCategory = getString('category')
    if (nextCategory !== null) setCategory(nextCategory)
    const nextLedgerCategory = getString('ledgerCategory')
    if (nextLedgerCategory && isSelectableLedgerCategory(nextLedgerCategory)) {
      setLedgerCategory(nextLedgerCategory)
    }
    const nextTxType = getString('txType')
    if (nextTxType === 'inflow' || nextTxType === 'outflow' || nextTxType === 'transfer') {
      setTxType(nextTxType)
    }
    const nextTransferSource = getString('transferSource')
    const nextTransferTarget = getString('transferTarget')
    if (nextTransferSource && isTransferBucket(nextTransferSource)) setTransferSource(nextTransferSource)
    if (nextTransferTarget && isTransferBucket(nextTransferTarget)) setTransferTarget(nextTransferTarget)
  }, [])

  useEffect(() => {
    if (!aiDraft) return
    setEditingTxId(null)
    setDescription('')
    setAmount('')
    setCategory(categories.length > 0 ? categories[0].name : '')
    setLedgerCategory('Essentials')
    setTxType('outflow')
    setDate(getTodayDateString())
    applyAiLedgerFields(aiDraft.fields)
    openTransactionForm()
    onAiDraftConsumed?.()
  }, [aiDraft?.nonce])

  useEffect(() => {
    if (!aiEditDraft) return
    let cancelled = false

    const openAiEditDraft = async () => {
      let target = transactions.find(t => String(t.id) === String(aiEditDraft.id))
      if (!target && onFetchTransactionById) {
        try {
          target = await onFetchTransactionById(String(aiEditDraft.id))
        } catch {
          target = undefined
        }
      }

      if (cancelled) return
      if (!target) {
        onShowAlert?.('Could not find the transaction AI selected.', 'AI Edit Failed')
        onAiEditDraftConsumed?.()
        return
      }

      handleStartEdit(target)
      applyAiLedgerFields(aiEditDraft.changes)
      onAiEditDraftConsumed?.()
    }

    void openAiEditDraft()
    return () => {
      cancelled = true
    }
  }, [aiEditDraft?.nonce])

  // Reset Ledger Category defaults on transaction type changes. In add mode,
  // switching to Inflow always defaults to Income (Auto-Split) -- a sensible
  // fresh-entry default. In edit mode, ledgerCategory was already populated
  // with the transaction's real value by handleStartEdit, so it's only reset
  // if it's actually invalid for the current type (mirrors the Outflow branch
  // below) -- otherwise every inflow edit would clobber a real bucket-targeted
  // or split value back to a bare "Income (Auto-Split)". The Category fallback
  // (Salary/first category) only applies in add mode for the same reason.
  useEffect(() => {
    if (txType === 'inflow') {
      if (!editingTxId) {
        setLedgerCategory('Income')
        const hasSalary = categories.some(c => c.name === 'Salary')
        if (hasSalary) {
          setCategory('Salary')
        } else if (categories.length > 0) {
          setCategory(categories[0].name)
        }
      } else if ((ledgerCategory || '').startsWith('Transfer:')) {
        setLedgerCategory('Income')
      }
    } else if (txType === 'outflow') {
      if (ledgerCategory === 'Income' || (ledgerCategory || '').startsWith('IncomeSplit:') || (ledgerCategory || '').startsWith('Transfer:')) {
        setLedgerCategory('Essentials')
      }
    }
  }, [txType, categories, editingTxId])

  // Auto-generate description for transfers -- add mode only. An edit's initial
  // description (the transaction's real, possibly custom, description) must
  // survive opening the form; regenerating it the instant the form mounts in
  // Transfer mode would silently discard whatever the user originally typed.
  useEffect(() => {
    if (txType === 'transfer' && !editingTxId) {
      setDescription(`Transfer from ${transferSource} to ${transferTarget}`)
    }
  }, [txType, transferSource, transferTarget, editingTxId])

  useEffect(() => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0].name)
    }
  }, [categories, category])

  const resetFormFields = () => {
    setDescription('')
    descriptionRef.current = ''
    autocompletedDescriptionRef.current = null
    setAmount('')
    setLedgerCategory('Essentials')
    const now = new Date()
    const y = now.getFullYear()
    const mo = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    setDate(`${y}-${mo}-${d}`)
    if (editingTxId && onStartEditPending) {
      onStartEditPending(null)
    }
    setEditingTxId(null)
    setShowAddForm(false)
    clearFormDraft()
    setErrors({})
    setCategorySuggestions([])
    setCategorySuggestionUnavailable(false)
    setNoteSuggestionUnavailable(false)
    setIsSuggestingCategory(false)
    categorySuggestionAbortRef.current?.abort()
    lastCategorySuggestionKeyRef.current = null
    setScanError(null)
    setShowScanBanner(false)
    if (activeReceiptScanJobId) {
      locallyStartedReceiptScanJobsRef.current.delete(activeReceiptScanJobId)
    }
    setActiveReceiptScanJobId(null)
    appliedReceiptScanJobRef.current = null
  }

  // Fully reset and close the transaction modal (used by Cancel / close / backdrop)
  const handleCloseForm = () => {
    const scanJobToClear = activeReceiptScanJobId
    setDescription('')
    descriptionRef.current = ''
    autocompletedDescriptionRef.current = null
    setAmount('')
    setLedgerCategory('Essentials')
    setTxType('outflow')
    setCategory(categories.length > 0 ? categories[0].name : '')
    setDate(getTodayDateString())
    setTransferSource('Essentials')
    setTransferTarget('Rewards')
    if (editingTxId && onStartEditPending) {
      onStartEditPending(null)
    }
    setEditingTxId(null)
    setShowAddForm(false)
    clearFormDraft()
    setErrors({})
    setCategorySuggestions([])
    setCategorySuggestionUnavailable(false)
    setNoteSuggestionUnavailable(false)
    setIsSuggestingCategory(false)
    categorySuggestionAbortRef.current?.abort()
    lastCategorySuggestionKeyRef.current = null
    setScanError(null)
    setShowScanBanner(false)
    if (scanJobToClear) {
      locallyStartedReceiptScanJobsRef.current.delete(scanJobToClear)
    }
    setActiveReceiptScanJobId(null)
    // Do NOT reset appliedReceiptScanJobRef here — keeping it prevents the
    // receiptScanDraft useEffect from re-applying the same scan result and
    // reopening the form after the user intentionally closes it.
    if (scanJobToClear) {
      void onReceiptScanCleared?.(scanJobToClear)
    }
  }

  // Open the form fresh (header button / quick action) — reset to defaults.
  const openFresh = () => {
    setDescription('')
    descriptionRef.current = ''
    autocompletedDescriptionRef.current = null
    setCategorySuggestions([])
    setIsSuggestingCategory(false)
    categorySuggestionAbortRef.current?.abort()
    lastCategorySuggestionKeyRef.current = null
    setAmount('')
    setTxType('outflow')
    setLedgerCategory('Essentials')
    setCategory(categories.length > 0 ? categories[0].name : '')
    setEditingTxId(null)
    setDate(getTodayDateString())
    openTransactionForm()
  }

  // Expose imperative actions to the parent. Route through a live ref so the
  // handle stays stale-closure-safe without a dependency array (this project
  // disables react-hooks/exhaustive-deps).
  const apiRef = useRef({ openFresh, handleCloseForm, handleStartEdit })
  apiRef.current = { openFresh, handleCloseForm, handleStartEdit }
  useImperativeHandle(ref, () => ({
    open: () => apiRef.current.openFresh(),
    close: () => apiRef.current.handleCloseForm(),
    startEdit: (t: Transaction) => apiRef.current.handleStartEdit(t),
  }), [])

  useEffect(() => {
    if (!showAddForm || editingTxId) return
    const isMobileSheet = window.matchMedia('(max-width: 639px), (pointer: coarse)').matches
    if (isMobileSheet) return

    const focusTimer = window.setTimeout(() => {
      firstInputRef.current?.focus()
    }, 450)

    return () => window.clearTimeout(focusTimer)
  }, [showAddForm, editingTxId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      newErrors.date = 'Posting date is required.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})

    let finalAmount = parsedAmount
    let finalLedgerCategory: string = ledgerCategory

    if (txType === 'outflow') {
      finalAmount = -Math.abs(parsedAmount)
    } else if (txType === 'inflow') {
      finalAmount = Math.abs(parsedAmount)
    } else if (txType === 'transfer') {
      finalAmount = Math.abs(parsedAmount)
      finalLedgerCategory = `Transfer:${transferSource}->${transferTarget}`
    }

    const isIncome = txType === 'inflow' && ledgerCategory === 'Income'

    if (isIncome) {
      finalLedgerCategory = computeIncomeLedgerCategory({
        amount: finalAmount,
        essentialsAlloc,
        growthAlloc,
        stabilityAlloc,
        rewardsAlloc,
        stabilityBalance,
        stabilityTarget,
        stabilityOverflowRedirect,
      })
    }

    if (editingTxId) {
      const targetId = editingTxId
      const scanJobToClear = activeReceiptScanJobId
      setEditingTxId(null)
      resetFormFields()
      if (scanJobToClear) {
        void onReceiptScanCleared?.(scanJobToClear)
      }
      await onUpdateTransaction?.(targetId, {
        description,
        amount: finalAmount,
        category: txType === 'transfer' ? 'Transfer' : category,
        ledgerCategory: finalLedgerCategory,
        date
      })
    } else {
      await onAddTransaction({
        description,
        amount: finalAmount,
        category: txType === 'transfer' ? 'Transfer' : category,
        ledgerCategory: finalLedgerCategory,
        date
      })
      const scanJobToClear = activeReceiptScanJobId
      resetFormFields()
      if (scanJobToClear) {
        void onReceiptScanCleared?.(scanJobToClear)
      }
    }
  }

  if (!showAddForm) return null

  return (
    <BottomSheet
      isOpen={showAddForm}
      onClose={handleCloseForm}
      maxWidthClassName="max-w-xl"
      title={
        <span className="flex items-center gap-2">
          <PlusCircle className="size-4 text-blue-500" /> {editingTxId ? 'Edit Ledger Entry' : 'Post New Ledger Entry'}
        </span>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* ── Scan Receipt button (add mode only) ── */}
        {!editingTxId && (
          <div className="sm:col-span-2">
            {/* Hidden input with capture: opens rear camera directly */}
            <input
              ref={scanFileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) { setShowScanPicker(false); handleScanReceipt(file) }
              }}
            />
            {/* Hidden input without capture: opens the photo gallery/library */}
            <input
              ref={scanGalleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) { setShowScanPicker(false); handleScanReceipt(file) }
              }}
            />

            {/* Main trigger button — collapses to a spinner while AI scans */}
            {!showScanPicker && (
              <button
                type="button"
                disabled={isScanning}
                onClick={() => {
                  setScanError(null)
                  if (!isScanning) setShowScanPicker(true)
                }}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border transition duration-200 text-xs font-semibold cursor-pointer ${
                  isScanning
                    ? 'perimeter-beam-host border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400 cursor-not-allowed'
                    : 'border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                }`}
              >
                {isScanning && <PerimeterBeam size={40} />}
                {isScanning ? (
                  <><Loader2 className="size-3.5 animate-spin" /> Scanning receipt...</>
                ) : (
                  <><Camera className="size-3.5" /><span>Scan Receipt</span></>
                )}
              </button>
            )}

            {/* Inline action picker — replaces button when tapped */}
            {showScanPicker && !isScanning && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => scanFileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 transition duration-200 text-xs font-semibold cursor-pointer"
                >
                  <Camera className="size-3.5" /> Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => scanGalleryInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 transition duration-200 text-xs font-semibold cursor-pointer"
                >
                  <Image className="size-3.5" /> Upload Photo
                </button>
                <button
                  type="button"
                  onClick={() => setShowScanPicker(false)}
                  className="flex items-center justify-center px-3 py-2.5 rounded-xl border border-border bg-muted hover:bg-muted/80 text-muted-foreground transition duration-200 text-xs font-semibold cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            {/* Scan success banner */}
            <AnimatePresence>
              {showScanBanner && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-2 flex items-start justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-medium">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    Receipt scanned — review fields below and edit as needed
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowScanBanner(false)}
                    className="shrink-0 text-emerald-500/60 hover:text-emerald-500 transition cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scan error */}
            <AnimatePresence>
              {scanError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-2 flex items-start justify-between gap-2 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-medium">
                    <AlertCircle className="size-3.5 shrink-0" />
                    {scanError}
                  </div>
                  <button
                    type="button"
                    onClick={() => setScanError(null)}
                    className="shrink-0 text-destructive/60 hover:text-destructive transition cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-semibold text-muted-foreground">Transaction Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleChangeTxType('outflow')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold rounded-xl border transition cursor-pointer ${
                txType === 'outflow'
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-500'
                  : 'border-border hover:bg-muted/50 text-muted-foreground'
              }`}
            >
              <MinusCircle className="size-3.5" /> Outflow (Debit)
            </button>
            <button
              type="button"
              onClick={() => handleChangeTxType('inflow')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold rounded-xl border transition cursor-pointer ${
                txType === 'inflow'
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-500'
                  : 'border-border hover:bg-muted/50 text-muted-foreground'
              }`}
            >
              <PlusCircle className="size-3.5" /> Inflow (Credit)
            </button>
            <button
              type="button"
              onClick={() => handleChangeTxType('transfer')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold rounded-xl border transition cursor-pointer ${
                txType === 'transfer'
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-500'
                  : 'border-border hover:bg-muted/50 text-muted-foreground'
              }`}
            >
              <RefreshCw className="size-3.5" /> Transfer
            </button>
          </div>
        </div>

        <div className="space-y-1 relative description-autocomplete">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Description</label>
            {txType !== 'transfer' && (
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => void requestNoteSuggestions()}
                disabled={isSuggestingNote || description.trim().length < 2}
                title={description.trim().length < 2 ? 'Enter a description first' : 'Suggest better notes'}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/5 px-2 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {isSuggestingNote ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                AI
              </button>
            )}
          </div>
          <div className={`relative ${isSuggestingNote ? 'perimeter-beam-host' : ''}`}>
            {isSuggestingNote && <PerimeterBeam radius={12} size={40} />}
            <input
              ref={firstInputRef}
              type="text"
              placeholder="e.g. Grocery Store, Paycheck"
              value={description}
              onBlur={handleDescriptionBlur}
              onChange={e => {
                const nextDescription = e.target.value
                descriptionRef.current = nextDescription
                setDescription(nextDescription)
                if (autocompletedDescriptionRef.current && autocompletedDescriptionRef.current !== nextDescription.trim()) {
                  autocompletedDescriptionRef.current = null
                }
                setCategorySuggestions([])
                setNoteSuggestions([])
                setShowNoteSuggestions(false)
                setIsSuggestingCategory(false)
                categorySuggestionAbortRef.current?.abort()
                noteSuggestionAbortRef.current?.abort()
                setIsSuggestingNote(false)
                lastCategorySuggestionKeyRef.current = null
                setShowSuggestions(true)
                setSelectedSuggestionIndex(-1)
                if (errors.description) {
                  setErrors(prev => ({ ...prev, description: '' }))
                }
              }}
              onFocus={() => {
                if (!showNoteSuggestions && description.trim().length >= 1) setShowSuggestions(true)
              }}
              onKeyDown={handleDescriptionKeyDown}
              autoComplete="off"
              className={`w-full px-3.5 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
                errors.description
                  ? 'border-destructive focus:ring-destructive'
                  : 'border-border focus:ring-blue-500'
              }`}
            />
          </div>
          {errors.description && (
            <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
              {errors.description}
            </p>
          )}
          {showNoteSuggestions && (
            <div className="absolute z-50 w-full mt-1 overflow-hidden bg-card border border-blue-500/25 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
              {isSuggestingNote ? (
                <div className="flex items-center gap-2 px-3.5 py-3 text-xs font-semibold text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin text-blue-500" />
                  Suggesting cleaner notes...
                </div>
              ) : noteSuggestions.length > 0 ? (
                noteSuggestions.map(s => (
                  <button
                    key={s.note}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => handleSelectNoteSuggestion(s)}
                    className="w-full text-left px-3.5 py-2.5 text-sm flex flex-col gap-0.5 cursor-pointer transition duration-100 hover:bg-blue-500/10 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <span className="font-semibold text-foreground">{s.note}</span>
                    <span className="text-[10px] text-muted-foreground">{s.reason}</span>
                  </button>
                ))
              ) : noteSuggestionUnavailable ? (
                <div className="px-3.5 py-3 text-xs font-semibold text-amber-600 dark:text-amber-500">
                  AI suggestions are unavailable right now. Please try again.
                </div>
              ) : (
                <div className="px-3.5 py-3 text-xs font-semibold text-muted-foreground">
                  No better note found for this description.
                </div>
              )}
            </div>
          )}
          {showSuggestions && !showNoteSuggestions && filteredSuggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 w-full mt-1 max-h-52 overflow-y-auto bg-card border border-border/80 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2 duration-150"
            >
              {filteredSuggestions.map((s, idx) => {
                const query = description.toLowerCase().trim()
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
                    onClick={() => handleSelectSuggestion(s)}
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
            </div>
          )}
          {!showNoteSuggestions && !description.trim() && quickSuggestionEntries.length > 0 && (
            <div
              onWheel={handleQuickSuggestionsWheel}
              className="no-scrollbar flex gap-1.5 overflow-x-auto overscroll-x-contain pt-1 pb-0.5"
            >
              {quickSuggestionEntries.map(s => (
                <button
                  key={s.description}
                  type="button"
                  onMouseDown={() => {
                    autocompletedDescriptionRef.current = s.description.trim()
                  }}
                  onClick={() => handleSelectSuggestion(s)}
                  className="shrink-0 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                >
                  {s.description}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Amount ({getCurrencySymbol(currency)})</label>
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

        {txType === 'transfer' ? (
          <>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Source Category (From)</label>
              <CustomSelect
                value={transferSource}
                onChange={val => setTransferSource(val as TransferBucket)}
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
              <label className="text-xs font-semibold text-muted-foreground">Target Category (To)</label>
              <CustomSelect
                value={transferTarget}
                onChange={val => setTransferTarget(val as TransferBucket)}
                options={[
                  { value: 'Essentials', label: 'Essentials' },
                  { value: 'Growth', label: 'Growth' },
                  { value: 'Stability', label: 'Stability' },
                  { value: 'Rewards', label: 'Rewards' }
                ]}
                className="w-full"
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-muted-foreground">Category</label>
                {isSuggestingCategory ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-500">
                    <Loader2 className="size-3 animate-spin" /> Suggesting
                  </span>
                ) : categorySuggestionUnavailable ? (
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-500">
                    AI suggestions unavailable
                  </span>
                ) : null}
              </div>
              <SearchableSelect
                value={category || (categories[0]?.name || '')}
                onChange={val => setCategory(val)}
                options={categorySelectOptions}
                className="w-full"
                placeholder="Search category…"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Ledger Category</label>
              <CustomSelect
                value={ledgerCategory}
                onChange={val => setLedgerCategory(val as typeof ledgerCategory)}
                options={[
                  ...(txType === 'inflow' ? [{ value: 'Income', label: 'Income (Auto-Split)' }] : []),
                  { value: 'Essentials', label: 'Essentials' },
                  { value: 'Growth', label: 'Growth' },
                  { value: 'Stability', label: 'Stability' },
                  { value: 'Rewards', label: 'Rewards' }
                ]}
                className="w-full"
              />
            </div>
          </>
        )}

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Posting Date</label>
          <input
            type="date"
            value={date}
            onChange={e => {
              setDate(e.target.value)
              if (errors.date) {
                setErrors(prev => ({ ...prev, date: '' }))
              }
            }}
            className={`w-full px-3.5 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
              errors.date
                ? 'border-destructive focus:ring-destructive'
                : 'border-border focus:ring-blue-500'
            }`}
          />
          {errors.date && (
            <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
              {errors.date}
            </p>
          )}
        </div>

        <div className="sm:col-span-2 flex gap-2 justify-end border-t border-border/30 pt-4 mt-1">
          <button
            type="button"
            onClick={handleCloseForm}
            className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted text-foreground transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/10 transition cursor-pointer"
          >
            {editingTxId ? 'Save Changes' : 'Post Transaction'}
          </button>
        </div>
      </form>
    </BottomSheet>
  )
})
