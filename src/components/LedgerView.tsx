import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'

import { motion, AnimatePresence } from 'framer-motion'
import { listContainerVariants } from '../lib/animations'
import type { Transaction, TransactionCategory } from '../types'
import type { PagedTransactionResult } from '../lib/api'
import { startReceiptScan, suggestTransactionCategories, suggestTransactionNotes, type CategorySuggestion, type ReceiptScanResult, type TransactionNoteSuggestion } from '../lib/api'
import {
  Plus,
  Search,
  Filter,
  Download,
  X,
  PlusCircle,
  MinusCircle,
  RefreshCw,
  AlertCircle,
  Loader2,
  Camera,
  Image,
  CheckCircle2,
  Sparkles
} from 'lucide-react'
import { CustomSelect } from './ui/CustomSelect'
import { SearchableSelect } from './ui/SearchableSelect'
import { CycleSkeleton } from './ui/Skeleton'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { BottomSheet } from './ui/BottomSheet'
import { SmartAmountInput } from './ui/SmartAmountInput'
import { PerimeterBeam } from './ui/PerimeterBeam'
import { lockBodyScroll, unlockBodyScroll } from '../lib/scrollLock'
import { formatCurrencyVal, getCurrencySymbol, maskCurrencyInput } from '../lib/utils'
import { getErrorMessage } from '../lib/errors'
import { getCategoryDotClass, getCategoryFilterClass } from '../lib/categoryColors'
import { downloadCsvBlob, downloadCsvRows, toFilename } from '../lib/csvExport'
import { useFormDraft } from '../lib/useFormDraft'
import { useAutoOpenModal } from '../lib/useAutoOpenModal'
import { useIsMobile } from '../lib/useIsMobile'
import { getCycleRangeDates, getStartOfNCyclesAgo, formatDateForApi } from '../lib/cycle'
import { getCycleLabelForDropdown, ordinal } from '../lib/cycleLabels'
import { computeIncomeLedgerCategory } from '../lib/incomeSplit'
import { matchesTransactionFilters, splitFilterSelections } from '../lib/transactionFilters'
import { calculateLedgerTotals } from '../lib/ledgerTotals'
import { useAppContext } from '../contexts/AppContext'
import { DesktopLedgerRow, MobileLedgerRow } from './ledger/LedgerRows'

const transactionSortKey = (t: Transaction) => t.postedAt || `${t.date}T00:00:00.000Z`

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

interface LedgerViewProps {
  transactions: Transaction[]
  autocompleteSuggestions?: import('../types').AutocompleteSuggestion[]
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void> | void
  onDeleteTransaction: (id: string) => Promise<void> | void
  onUpdateTransaction?: (id: string, transaction: Omit<Transaction, 'id'>) => Promise<void> | void
  hideSensitive?: boolean
  categories: TransactionCategory[]
  selectedMonth: string
  selectedYear: number
  availableYears: number[]
  cycleDay: number
  onSelectPeriod: (month: string, year: number) => void
  incomingCategory: string | null
  incomingSearch?: string | null
  incomingDate?: string | null
  incomingTxType?: 'inflow' | 'outflow' | 'transfer' | null
  highlightedTxId?: string | null
  onClearIncomingFilters?: () => void
  showAllCycles: boolean
  onClearAllCycles: () => void
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly'
  currency?: string
  autoOpenAddForm?: boolean
  onResetAutoOpen?: () => void
  stabilityBalance?: number
  stabilityTarget?: number
  essentialsAlloc?: number
  growthAlloc?: number
  stabilityAlloc?: number
  rewardsAlloc?: number
  stabilityOverflowRedirect?: string
  onFetchPagedTransactions?: (params: {
    page: number
    pageSize: number
    search?: string
    ledgerCategories?: string[]
    categories?: string[]
    txType?: 'inflow' | 'outflow' | 'transfer' | null
    startDate?: string
    endDate?: string
  }) => Promise<PagedTransactionResult>
  onFetchTransactionById?: (id: string) => Promise<Transaction>
  onExportTransactions?: (params: {
    search?: string
    ledgerCategories?: string[]
    categories?: string[]
    txType?: 'inflow' | 'outflow' | 'transfer' | null
    startDate?: string
    endDate?: string
  }) => Promise<{ blob: Blob; filename: string }>
  onShowAlert?: (message: string, title?: string) => void
  activeSyncId?: string | null
  deletingTxId?: string | null
  onStartEditPending?: (id: string | null) => void
  isSwitchingCycle?: boolean
  receiptScanDraft?: { jobId: string; result: ReceiptScanResult } | null
  onReceiptScanStarted?: (scanId: string) => void
  onReceiptScanCleared?: (scanId: string) => void | Promise<void>
  onAddFormOpenChange?: (open: boolean) => void
  activeScanJobIds?: string[]
  failedScanJob?: { jobId: string; errorMessage: string } | null
  aiDraft?: { nonce: number; fields: Record<string, unknown> } | null
  aiEditDraft?: { nonce: number; id: string; changes: Record<string, unknown> } | null
  aiExportRequest?: { nonce: number } | null
  onAiDraftConsumed?: () => void
  onAiEditDraftConsumed?: () => void
  onAiExportRequestConsumed?: () => void
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  transactions,
  autocompleteSuggestions = [],
  onAddTransaction,
  onDeleteTransaction,
  onUpdateTransaction,
  hideSensitive: hideSensitiveProp,
  categories,
  selectedMonth,
  selectedYear,
  availableYears,
  cycleDay,
  onSelectPeriod,
  incomingCategory,
  incomingSearch,
  incomingDate,
  incomingTxType,
  highlightedTxId,
  onClearIncomingFilters,
  showAllCycles,
  onClearAllCycles,
  cyclesRange,
  currency: currencyProp,
  autoOpenAddForm,
  onResetAutoOpen,
  stabilityBalance = 0,
  stabilityTarget = 10000,
  essentialsAlloc = 0.5,
  growthAlloc = 0.25,
  stabilityAlloc = 0.15,
  rewardsAlloc = 0.1,
  stabilityOverflowRedirect = 'Split: Growth 50%, Rewards 50%',
  onFetchPagedTransactions,
  onFetchTransactionById,
  onExportTransactions,
  onShowAlert,
  activeSyncId: activeSyncIdProp,
  deletingTxId: deletingTxIdProp,
  onStartEditPending,
  isSwitchingCycle = false,
  receiptScanDraft = null,
  onReceiptScanStarted,
  onReceiptScanCleared,
  onAddFormOpenChange,
  activeScanJobIds = [],
  failedScanJob = null,
  aiDraft = null,
  aiEditDraft = null,
  aiExportRequest = null,
  onAiDraftConsumed,
  onAiEditDraftConsumed,
  onAiExportRequestConsumed
}) => {
  const app = useAppContext()
  const hideSensitive = hideSensitiveProp ?? app.hideSensitive
  const currency = currencyProp ?? app.currency
  const activeSyncId = activeSyncIdProp ?? app.activeSyncId
  const deletingTxId = deletingTxIdProp ?? app.deletingId
  const isMobile = useIsMobile(768)
  const [showAddForm, setShowAddForm] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [txType, setTxType] = useState<'inflow' | 'outflow' | 'transfer'>('outflow')
  const [category, setCategory] = useState('')
  const [ledgerCategory, setLedgerCategory] = useState<SelectableLedgerCategory>('Essentials')
  const [transferSource, setTransferSource] = useState<TransferBucket>('Essentials')
  const [transferTarget, setTransferTarget] = useState<TransferBucket>('Rewards')
  const getTodayDateString = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
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

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)
  const [showEditDisabledModal, setShowEditDisabledModal] = useState(false)

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

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilters, setSelectedFilters] = useState<string[]>([])
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null)
  const [selectedTxTypeFilter, setSelectedTxTypeFilter] = useState<'inflow' | 'outflow' | 'transfer' | null>(null)
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)

  // Pagination states (Defaults: page size 10, current page 1)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Server-side paged all-cycles state
  const [serverResult, setServerResult] = useState<PagedTransactionResult | null>(null)
  const [serverIsFetching, setServerIsFetching] = useState(false)
  const isInitialFetchDone = useRef(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportIsFetching, setExportIsFetching] = useState(false)
  useEffect(() => {
    if (!aiExportRequest) return
    if (!hideSensitive) setShowExportModal(true)
    onAiExportRequestConsumed?.()
  }, [aiExportRequest?.nonce])
  // Pending (uncommitted) states -- only applied on Search/Apply button click
  const [pendingSearchTerm, setPendingSearchTerm] = useState('')
  const [pendingFilters, setPendingFilters] = useState<string[]>([])
  // Applied (committed) states -- what the backend has actually received
  const [appliedSearch, setAppliedSearch] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<string[]>([])
  const [appliedTxTypeFilter, setAppliedTxTypeFilter] = useState<'inflow' | 'outflow' | 'transfer' | null>(null)

  const ledgerBuckets = ['Essentials', 'Growth', 'Stability', 'Rewards', 'Income']
  const allCyclesRange = useMemo(() => {
    if (!showAllCycles) return null
    if (!cyclesRange || cyclesRange === 'monthly') return null
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const activeMonthIdx = monthNames.indexOf(selectedMonth) + 1
    if (activeMonthIdx <= 0) return null
    const activeYear = selectedYear

    let startDate: Date | null = null
    let endDate: Date | null = null

    if (cyclesRange === '3month') {
      startDate = getStartOfNCyclesAgo(activeYear, activeMonthIdx, cycleDay, 3)
      endDate = getCycleRangeDates(activeYear, activeMonthIdx, cycleDay).end
    } else if (cyclesRange === '6month') {
      startDate = getStartOfNCyclesAgo(activeYear, activeMonthIdx, cycleDay, 6)
      endDate = getCycleRangeDates(activeYear, activeMonthIdx, cycleDay).end
    } else if (cyclesRange === 'yearly') {
      startDate = getCycleRangeDates(activeYear, 1, cycleDay).start
      endDate = getCycleRangeDates(activeYear, 12, cycleDay).end
    }

    if (!startDate || !endDate) return null
    return {
      startDate: formatDateForApi(startDate),
      endDate: formatDateForApi(endDate)
    }
  }, [showAllCycles, cyclesRange, selectedMonth, selectedYear, cycleDay])

  // Transaction ids whose sync op just finished (isPendingSync already false) but
  // whose effect isn't reflected in `serverResult` yet -- that snapshot is a
  // separate fetch (below) that only starts once the whole queue drain finishes,
  // so there's a real gap between "confirmed by server" and "serverResult knows
  // it". Kept covered by the optimistic overlay (see filteredPendingTransactions)
  // until the next successful runServerFetch, instead of dropping out the moment
  // isPendingSync flips and showing whatever stale value serverResult still has.
  const [recentlySyncedIds, setRecentlySyncedIds] = useState<Set<string>>(new Set())

  const runServerFetch = useCallback(async (opts: {
    page: number
    search: string
    filters: string[]
    txType: 'inflow' | 'outflow' | 'transfer' | null
    pSize: number
  }) => {
    if (!onFetchPagedTransactions) return
    setServerIsFetching(true)
    try {
      const buckets = opts.filters.filter(f => ledgerBuckets.includes(f))
      const cats = opts.filters.filter(f => !ledgerBuckets.includes(f))
      const result = await onFetchPagedTransactions({
        page: opts.page,
        pageSize: opts.pSize,
        search: opts.search || undefined,
        ledgerCategories: buckets.length > 0 ? buckets : undefined,
        categories: cats.length > 0 ? cats : undefined,
        txType: opts.txType || null,
        startDate: allCyclesRange?.startDate,
        endDate: allCyclesRange?.endDate
      })
      setServerResult(result)
      // A fresh fetch is authoritative for everything it covers -- whatever was
      // "not yet reconciled" now is, so the overlay can stand down.
      setRecentlySyncedIds(new Set())
    } finally {
      setServerIsFetching(false)
    }
  }, [onFetchPagedTransactions, allCyclesRange])

  // Trigger initial server fetch when entering all-cycles mode
  useEffect(() => {
    if (showAllCycles && onFetchPagedTransactions) {
      const initialFilters = incomingCategory ? [incomingCategory] : []
      const initialTxType = incomingTxType || null
      const initialSearch = incomingSearch || ''

      setPendingSearchTerm(initialSearch)
      setPendingFilters(initialFilters)
      setAppliedSearch(initialSearch)
      setAppliedFilters(initialFilters)
      setAppliedTxTypeFilter(initialTxType)
      setCurrentPage(1)
      setPageSize(100)  // Default 100 for server mode -- covers most users' full history on page 1
      isInitialFetchDone.current = false
      runServerFetch({ page: 1, search: initialSearch, filters: initialFilters, txType: initialTxType, pSize: 100 })
        .finally(() => {
          isInitialFetchDone.current = true
        })
    } else {
      setServerResult(null)
      isInitialFetchDone.current = false
    }
  }, [showAllCycles, onFetchPagedTransactions, runServerFetch, allCyclesRange, incomingCategory, incomingTxType, incomingSearch])

  // Re-fetch when page changes in server mode
  useEffect(() => {
    if (showAllCycles && onFetchPagedTransactions && isInitialFetchDone.current) {
      runServerFetch({ page: currentPage, search: appliedSearch, filters: appliedFilters, txType: appliedTxTypeFilter, pSize: pageSize })
    }
  }, [currentPage, pageSize, showAllCycles, onFetchPagedTransactions, runServerFetch, appliedSearch, appliedFilters, appliedTxTypeFilter, allCyclesRange])

  // Re-fetch server result when activeSyncId transitions from non-null to null (sync completed)
  const prevActiveSyncId = useRef<string | null>(null)
  useEffect(() => {
    // activeSyncId moves off an id the instant that op's dispatch finishes (each op
    // in a batch gets its own turn as activeSyncId before the next one starts) --
    // that id's isPendingSync flips false right away, well before serverResult is
    // refetched below. Keep it in the overlay until then.
    if (prevActiveSyncId.current !== null && prevActiveSyncId.current !== activeSyncId) {
      const finishedId = prevActiveSyncId.current
      setRecentlySyncedIds(prev => {
        const next = new Set(prev)
        next.add(finishedId)
        return next
      })
    }
    if (showAllCycles && prevActiveSyncId.current !== null && activeSyncId === null && onFetchPagedTransactions && isInitialFetchDone.current) {
      runServerFetch({ page: currentPage, search: appliedSearch, filters: appliedFilters, txType: appliedTxTypeFilter, pSize: pageSize })
    }
    prevActiveSyncId.current = activeSyncId
  }, [activeSyncId, showAllCycles, currentPage, appliedSearch, appliedFilters, appliedTxTypeFilter, pageSize, onFetchPagedTransactions, runServerFetch])

  // Reset back to page 1 when search inputs or active filters are updated (client-side mode only)
  useEffect(() => {
    if (!showAllCycles) setCurrentPage(1)
  }, [searchTerm, selectedFilters, selectedDateFilter, selectedTxTypeFilter, showAllCycles])

  // Synchronize incoming filters from props
  useEffect(() => {
    if (incomingCategory) {
      setSelectedFilters([incomingCategory])
    } else {
      setSelectedFilters([])
    }
  }, [incomingCategory])

  useEffect(() => {
    setSearchTerm(incomingSearch || '')
  }, [incomingSearch])

  useEffect(() => {
    setSelectedDateFilter(incomingDate || null)
  }, [incomingDate])

  useEffect(() => {
    setSelectedTxTypeFilter(incomingTxType || null)
  }, [incomingTxType])

  // Toggle filter on or off
  const handleToggleFilter = (filterName: string) => {
    const ledgerCategories = ['Essentials', 'Growth', 'Stability', 'Rewards', 'Income'];
    const isLedgerCategory = ledgerCategories.includes(filterName);
    const groupFilters = isLedgerCategory
      ? ledgerCategories
      : categories.map(c => c.name);

    const updateFilterList = (prev: string[]) => {
      let next;
      if (prev.includes(filterName)) {
        next = prev.filter(f => f !== filterName);
      } else {
        next = [...prev, filterName];
      }

      // Check if all filters in the group are now selected
      const groupSelectedCount = next.filter(f => groupFilters.includes(f)).length;
      if (groupSelectedCount === groupFilters.length) {
        // Deselect all filters in this group
        next = next.filter(f => !groupFilters.includes(f));
      }
      return next;
    };

    if (showAllCycles) {
      // In server mode: toggle pending filters only
      setPendingFilters(prev => updateFilterList(prev));
    } else {
      setSelectedFilters(prev => updateFilterList(prev));
    }
  }

  const handleClearFilters = () => {
    if (showAllCycles) {
      setPendingFilters([])
      setAppliedFilters([])
      setCurrentPage(1)
      runServerFetch({ page: 1, search: appliedSearch, filters: [], txType: appliedTxTypeFilter, pSize: pageSize })
    } else {
      setSelectedFilters([])
    }
  }

  const handleApplyFilters = () => {
    setAppliedFilters(pendingFilters)
    setCurrentPage(1)
    setIsFilterDropdownOpen(false)
    runServerFetch({ page: 1, search: appliedSearch, filters: pendingFilters, txType: appliedTxTypeFilter, pSize: pageSize })
  }

  const handleServerSearch = () => {
    setAppliedSearch(pendingSearchTerm)
    setCurrentPage(1)
    runServerFetch({ page: 1, search: pendingSearchTerm, filters: appliedFilters, txType: appliedTxTypeFilter, pSize: pageSize })
  }

  // Toggle dropdown on click out & lock body scrolling while filter dropdown is open.
  // Uses the shared ref-counted lock so it composes with the mobile filter
  // BottomSheet (same open flag) instead of fighting it over body styles.
  useEffect(() => {
    if (!isFilterDropdownOpen) return
    lockBodyScroll()
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.ledger-filter-dropdown')) {
        setIsFilterDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => {
      unlockBodyScroll()
      document.removeEventListener('click', handleClick)
    }
  }, [isFilterDropdownOpen])

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

  // NOTE: body scroll locking for showAddForm / showExportModal /
  // showStabilityCapModal is handled by each modal's own <BottomSheet> (which
  // uses the shared ref-counted lock). A second lock here duplicated that work
  // on the same <body> and, because the two snapshot/restore cycles raced,
  // could restore a stale "locked" snapshot and leave the page unscrollable.

  useEffect(() => {
    if (!showAddForm || editingTxId) return
    const isMobileSheet = window.matchMedia('(max-width: 639px), (pointer: coarse)').matches
    if (isMobileSheet) return

    const focusTimer = window.setTimeout(() => {
      firstInputRef.current?.focus()
    }, 450)

    return () => window.clearTimeout(focusTimer)
  }, [showAddForm, editingTxId])

  const handleDeleteClick = (t: Transaction) => {
    if (hideSensitive) return
    setTxToDelete(t)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = async () => {
    if (!txToDelete) return

    let deleteId = txToDelete.id
    if (txToDelete.id.includes('-split-')) {
      deleteId = txToDelete.id.split('-split-')[0]
    }

    setShowDeleteModal(false)
    setTxToDelete(null)

    await onDeleteTransaction(deleteId)
  }

  const handleCancelDelete = () => {
    setShowDeleteModal(false)
    setTxToDelete(null)
  }

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

  const isTxDeleting = useCallback((txId: string) => {
    const txObj = transactions.find(t => t.id === txId)
    if (txObj && txObj.isPendingDelete) return true
    if (!deletingTxId) return false
    if (txId === deletingTxId) return true
    if (txId.startsWith(`${deletingTxId}-split-`)) return true
    if (txId.includes('-split-') && txId.split('-split-')[0] === deletingTxId) return true
    return false
  }, [deletingTxId, transactions])

  const isTxSyncing = useCallback((txId: string) => {
    if (!activeSyncId) return false
    if (txId === activeSyncId) return true
    if (txId === `wishlist-purchase-${activeSyncId}`) return true
    if (txId.startsWith(`${activeSyncId}-split-`)) return true
    if (txId.includes('-split-') && txId.split('-split-')[0] === activeSyncId) return true
    return false
  }, [activeSyncId])

  const sourceTransactions = useMemo(() => transactions, [transactions])

  const pendingTransactions = useMemo(() => {
    return transactions.filter(t => t.isPendingSync || recentlySyncedIds.has(String(t.id)))
  }, [transactions, recentlySyncedIds])

  const filteredPendingTransactions = useMemo(() => {
    if (!showAllCycles) return []
    
    const { buckets: selectedBuckets, categories: selectedCategories } = splitFilterSelections(appliedFilters)

    return pendingTransactions.filter(t => {
      // Date range filter (specific to the all-cycles list)
      if (allCyclesRange) {
        const txDate = new Date(t.date)
        const startLimit = new Date(allCyclesRange.startDate)
        const endLimit = new Date(allCyclesRange.endDate)
        startLimit.setHours(0, 0, 0, 0)
        endLimit.setHours(23, 59, 59, 999)
        if (txDate < startLimit || txDate > endLimit) return false
      }

      return matchesTransactionFilters(t, {
        search: appliedSearch,
        buckets: selectedBuckets,
        categories: selectedCategories,
        txType: appliedTxTypeFilter,
      })
    }).sort((a, b) => {
      const dateDiff = transactionSortKey(b).localeCompare(transactionSortKey(a))
      if (dateDiff !== 0) return dateDiff
      return b.id.localeCompare(a.id)
    })
  }, [pendingTransactions, showAllCycles, appliedSearch, appliedFilters, appliedTxTypeFilter, allCyclesRange])

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    // Group filters by their type (Ledger Categories vs Categories)
    const { buckets: selectedBuckets, categories: selectedCategories } = splitFilterSelections(selectedFilters)

    return sourceTransactions.filter(t => {
      // Exact-day date filter (specific to the current-cycle list)
      if (selectedDateFilter && t.date !== selectedDateFilter) return false

      return matchesTransactionFilters(t, {
        search: searchTerm,
        buckets: selectedBuckets,
        categories: selectedCategories,
        txType: selectedTxTypeFilter,
      })
    }).sort((a, b) => {
      const dateDiff = transactionSortKey(b).localeCompare(transactionSortKey(a))
      if (dateDiff !== 0) return dateDiff
      
      const aPending = a.isPendingSync ? 1 : 0
      const bPending = b.isPendingSync ? 1 : 0
      if (bPending !== aPending) {
        return bPending - aPending
      }
      
      return b.id.localeCompare(a.id)
    })
  }, [sourceTransactions, searchTerm, selectedFilters, selectedDateFilter, selectedTxTypeFilter])

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredTransactions.slice(startIndex, startIndex + pageSize)
  }, [filteredTransactions, currentPage, pageSize])

  // In server mode use the items from server with prepended matching pending transactions; in client mode use local pagination
  const displayTransactions = useMemo(() => {
    if (showAllCycles && serverResult) {
      return [...filteredPendingTransactions, ...serverResult.items]
    }
    return paginatedTransactions
  }, [showAllCycles, serverResult, filteredPendingTransactions, paginatedTransactions])

  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1

  // Clamp currentPage whenever the underlying data set shrinks or changes out
  // from under it (switching to a cycle with fewer pages, deleting the last
  // items on the final page) — otherwise the pager gets stuck on an
  // out-of-range page showing "No transactions" until manually navigated.
  useEffect(() => {
    if (!showAllCycles && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, showAllCycles, currentPage])

  // Handle highlighted transaction scroll into view and page calculation
  useEffect(() => {
    if (highlightedTxId) {
      const index = filteredTransactions.findIndex(t => t.id === highlightedTxId)
      if (index !== -1) {
        const targetPage = Math.floor(index / pageSize) + 1
        setCurrentPage(targetPage)
        
        const timer = setTimeout(() => {
          const rowEl = document.getElementById(`tx-row-${highlightedTxId}`)
          if (rowEl) {
            rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
            rowEl.classList.add('bg-blue-500/10', 'ring-2', 'ring-blue-500/30', 'dark:bg-blue-500/20')
            const clearTimer = setTimeout(() => {
              rowEl.classList.remove('bg-blue-500/10', 'ring-2', 'ring-blue-500/30', 'dark:bg-blue-500/20')
              onClearIncomingFilters?.()
            }, 3000)
            return () => clearTimeout(clearTimer)
          }
        }, 300)
        return () => clearTimeout(timer)
      }
    }
  }, [highlightedTxId, filteredTransactions, pageSize, onClearIncomingFilters])

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

  const pageTotals = useMemo(() => calculateLedgerTotals(displayTransactions), [displayTransactions])

  // Stable handler identities for the memoized ledger rows. The refs keep the wrappers
  // stale-closure-safe (they always invoke the latest closure), so the rows get a
  // constant function reference across renders and React.memo can skip re-rendering
  // them -- without needing a dependency array on these heavyweight handlers (this
  // project disables react-hooks/exhaustive-deps, so a hand-maintained one would be a
  // silent-staleness hazard).
  const handleStartEditRef = useRef(handleStartEdit)
  const handleDeleteClickRef = useRef(handleDeleteClick)
  useEffect(() => {
    handleStartEditRef.current = handleStartEdit
    handleDeleteClickRef.current = handleDeleteClick
  })
  const onStartEditStable = useCallback((t: Transaction) => handleStartEditRef.current(t), [])
  const onDeleteClickStable = useCallback((t: Transaction) => handleDeleteClickRef.current(t), [])
  const onSplitEditBlockedStable = useCallback(() => setShowEditDisabledModal(true), [])

  const isServerMode = showAllCycles && !!serverResult

  const getCycleRangeLabel = () => {
    if (cyclesRange === '3month') return 'Last 3 Cycles'
    if (cyclesRange === '6month') return 'Last 6 Cycles'
    if (cyclesRange === 'yearly') return `Full Year ${selectedYear}`
    return ''
  }

  const buildFilterLabel = () => {
    const buckets = appliedFilters.filter(f => ledgerBuckets.includes(f))
    const cats = appliedFilters.filter(f => !ledgerBuckets.includes(f))
    const categoryFilters = [...buckets, ...cats]
    const parts: string[] = []
    if (categoryFilters.length > 0) {
      const label = categoryFilters.join(' + ')
      parts.push(`${label} ${categoryFilters.length > 1 ? 'Categories' : 'Category'}`)
    }
    if (appliedTxTypeFilter) {
      parts.push(appliedTxTypeFilter === 'inflow' ? 'Inflows' : appliedTxTypeFilter === 'outflow' ? 'Outflows' : 'Transfers')
    }
    if (appliedSearch) {
      parts.push(`Search ${appliedSearch}`)
    }
    return parts.join(' ')
  }

  const getExportAllFilename = () => {
    if (!showAllCycles) {
      const cycleLabel = getCycleLabelForDropdown(selectedMonth, selectedYear, cycleDay)
      return `${toFilename(cycleLabel)}.csv`
    }

    const rangeLabel = getCycleRangeLabel()
    const filterLabel = buildFilterLabel()
    const title = rangeLabel
      ? (filterLabel ? `${rangeLabel} ${filterLabel} Records` : `${rangeLabel} Records`)
      : (filterLabel ? `All ${filterLabel} Records` : 'All Records')
    return `${toFilename(title)}.csv`
  }

  const getPageExportFilename = (rows: Transaction[]) => {
    if (rows.length === 0) {
      return `Ledger_Page_${currentPage}.csv`
    }
    const dates = rows.map(r => r.date)
    let minDate = dates[0]
    let maxDate = dates[0]
    for (const d of dates) {
      if (d < minDate) minDate = d
      if (d > maxDate) maxDate = d
    }
    const label = minDate === maxDate ? minDate : `${minDate}_to_${maxDate}`
    return `${toFilename(label)}.csv`
  }

  const handleExportPage = () => {
    if (hideSensitive) return
    // Match what's actually rendered on the page (displayTransactions),
    // which prepends pending/unsynced rows in server mode.
    const rows = isServerMode ? [...filteredPendingTransactions, ...(serverResult?.items || [])] : paginatedTransactions
    downloadCsvRows(rows, getPageExportFilename(rows))
    setShowExportModal(false)
  }

  const handleExportAll = async () => {
    if (hideSensitive) return
    if (isServerMode && onExportTransactions) {
      setExportIsFetching(true)
      try {
        const buckets = appliedFilters.filter(f => ledgerBuckets.includes(f))
        const cats = appliedFilters.filter(f => !ledgerBuckets.includes(f))
        const result = await onExportTransactions({
          search: appliedSearch || undefined,
          ledgerCategories: buckets.length > 0 ? buckets : undefined,
          categories: cats.length > 0 ? cats : undefined,
          txType: appliedTxTypeFilter || null,
          startDate: allCyclesRange?.startDate,
          endDate: allCyclesRange?.endDate
        })
        downloadCsvBlob(result.blob, getExportAllFilename())
        setShowExportModal(false)
      } catch (err) {
        console.error(err)
        if (onShowAlert) {
          onShowAlert('Failed to export transactions.', 'Export Error')
        } else {
          alert('Failed to export transactions.')
        }
      } finally {
        setExportIsFetching(false)
      }
      return
    }
    downloadCsvRows(filteredTransactions, getExportAllFilename())
    setShowExportModal(false)
  }

  const renderPageNumbers = (tp = totalPages) => {
    const pages: (number | string)[] = []
    if (tp <= 5) {
      for (let i = 1; i <= tp; i++) pages.push(i)
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, '...', tp)
      } else if (currentPage >= tp - 2) {
        pages.push(1, '...', tp - 2, tp - 1, tp)
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', tp)
      }
    }
    return pages.map((p, idx) => (
      p === '...' ? (
        <span key={`dots-${idx}`} className="px-2 py-1.5 text-muted-foreground text-xs select-none">...</span>
      ) : (
        <button
          key={`page-${p}`}
          onClick={() => setCurrentPage(p as number)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${
            currentPage === p
              ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
              : 'border-border bg-background hover:bg-muted text-foreground'
          }`}
        >
          {p}
        </button>
      )
    ))
  }

  if (isSwitchingCycle) {
    return <CycleSkeleton variant="ledger" />
  }

  return (
    <div className="space-y-6 soft-rise">
      
      {/* Header section with total and actions */}
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">Financial Ledger</h2>
            
            {/* Cycle Selector */}
            <div className="flex items-center gap-1.5 select-none w-full sm:w-auto">
              <CustomSelect
                value={selectedMonth}
                onChange={(val) => onSelectPeriod(val, selectedYear)}
                options={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => ({
                  value: m,
                  label: getCycleLabelForDropdown(m, selectedYear, cycleDay)
                }))}
                className="flex-1 sm:w-56 sm:flex-initial"
              />
              <CustomSelect
                value={selectedYear}
                onChange={(val) => onSelectPeriod(selectedMonth, Number(val))}
                options={availableYears.map(y => ({
                  value: y,
                  label: y.toString()
                }))}
                className="w-20 sm:w-28 shrink-0"
                align="right"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Comprehensive posting of all accounts and transactional balances for the currently selected cycle.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:w-auto md:gap-3">
          <button
            onClick={() => setShowExportModal(true)}
            disabled={hideSensitive}
            className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-xl border border-border font-medium text-xs transition duration-200 md:flex-initial ${
              hideSensitive 
                ? 'opacity-40 cursor-not-allowed bg-background text-muted-foreground' 
                : 'bg-background hover:bg-muted text-foreground cursor-pointer'
            }`}
            title={hideSensitive ? 'CSV Export disabled in blur mode' : 'Export CSV'}
          >
            <Download className="size-3.5 text-muted-foreground" />
            Export CSV
          </button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              if (showAddForm) {
                handleCloseForm()
              } else {
                // Opening the form fresh -- reset to defaults
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
                const now = new Date()
                const y = now.getFullYear()
                const mo = String(now.getMonth() + 1).padStart(2, '0')
                const d = String(now.getDate()).padStart(2, '0')
                setDate(`${y}-${mo}-${d}`)
                openTransactionForm()
              }
            }}
            className="flex-1 whitespace-nowrap rounded-xl text-xs shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 duration-200 md:flex-initial"
          >
            {showAddForm ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {showAddForm ? 'Cancel' : 'Post Transaction'}
          </Button>
        </div>
      </Card>

      {/* Dashboard navigation filter banner */}
      {(() => {
        // Derive the banner from the LIVE applied/selected filters, never from the incoming
        // navigation props: those are only the initial intent and don't change when the user
        // unticks a filter, which left a stale "filtered by Stability" hanging around. In
        // all-cycles (server) mode the applied* state is authoritative; otherwise selected*.
        const activeCategoryFilters = showAllCycles ? appliedFilters : selectedFilters
        const activeTxType = showAllCycles ? appliedTxTypeFilter : selectedTxTypeFilter
        const activeSearch = showAllCycles ? appliedSearch : searchTerm
        const activeDate = selectedDateFilter
        const hasAnyFilter = activeCategoryFilters.length > 0 || !!activeTxType || !!activeSearch || !!activeDate
        if (!showAllCycles && !hasAnyFilter) return null

        const parts: string[] = []
        if (showAllCycles) {
          if (cyclesRange === '3month') parts.push("last 3 cycles")
          else if (cyclesRange === '6month') parts.push("last 6 cycles")
          else if (cyclesRange === 'yearly') parts.push(`full year ${selectedYear}`)
          else parts.push("all cycles")
        } else {
          parts.push("current cycle")
        }

        const filterDetails: string[] = []
        const ledgerCategories = ['Essentials', 'Growth', 'Stability', 'Rewards', 'Income']
        const selectedBuckets = activeCategoryFilters.filter(f => ledgerCategories.includes(f))
        const selectedCats = activeCategoryFilters.filter(f => !ledgerCategories.includes(f))

        if (selectedBuckets.length > 0) {
          const names = selectedBuckets.map(b => `"${b}"`).join(' and ')
          filterDetails.push(`ledger category ${names}`)
        }
        if (selectedCats.length > 0) {
          const names = selectedCats.map(c => `"${c}"`).join(' and ')
          filterDetails.push(`category ${names}`)
        }
        if (activeDate) {
          const d = new Date(activeDate)
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const formattedDate = isNaN(d.getTime()) ? activeDate : `${monthNames[d.getMonth()]} ${ordinal(d.getDate())}, ${d.getFullYear()}`
          filterDetails.push(`date ${formattedDate}`)
        }
        if (activeTxType) {
          filterDetails.push(activeTxType === 'inflow' ? "inflows only" : "outflows only")
        }
        if (activeSearch) {
          filterDetails.push(`search "${activeSearch}"`)
        }

        const label = filterDetails.length > 0
          ? `Showing ${parts.join(', ')} — filtered by ${filterDetails.join(' & ')}`
          : `Showing ${parts.join(', ')}`

        return (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-blue-500/8 border border-blue-500/20 text-xs animate-in fade-in duration-200">
          <div className="flex min-w-0 items-center gap-2 text-blue-500 font-medium leading-relaxed">
            <span className="size-1.5 rounded-full bg-blue-500 shrink-0 animate-pulse" />
            {label}
          </div>
          <button
            onClick={() => {
              onClearIncomingFilters?.()
              onClearAllCycles?.()
              setSelectedFilters([])
              setSelectedDateFilter(null)
              setSelectedTxTypeFilter(null)
              setSearchTerm('')
              setPendingFilters([])
              setAppliedFilters([])
              setAppliedSearch('')
              setAppliedTxTypeFilter(null)
            }}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap text-blue-500/70 hover:text-blue-500 text-[10px] font-semibold transition cursor-pointer"
          >
            <X className="size-3" /> Clear filter
          </button>
        </div>
        )
      })()}

      {/* Post Transaction Modal (bottom sheet on mobile) */}
      {showAddForm && (
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
                    className={`inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/5 px-2 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer ${isSuggestingNote ? 'perimeter-beam-host' : ''}`}
                  >
                    {isSuggestingNote && <PerimeterBeam radius={8} size={52} />}
                    {isSuggestingNote ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                    AI
                  </button>
                )}
              </div>
              <div className="relative">
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
                    onChange={val => setTransferSource(val)}
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
                    onChange={val => setTransferTarget(val)}
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
      )}

      {/* Filter and Search controls (sticky under the header so filtering long lists is reachable) */}
      <div
        style={{ top: 'calc(4rem + env(safe-area-inset-top, 0px))' }}
        className="sticky z-30 flex flex-row items-center justify-between gap-2 md:gap-4 p-2 md:p-4 bg-card/90 supports-[backdrop-filter]:bg-card/75 backdrop-blur-md border border-border/60 rounded-xl md:rounded-2xl shadow-sm"
      >
        {showAllCycles ? (
          /* Server mode: input pill + Search button fused into one focus-aware
             control so the two read as a single element rather than two boxes. */
          <div className="group flex min-w-0 flex-1 items-stretch md:w-auto overflow-hidden rounded-xl border border-border bg-card shadow-sm transition duration-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25 hover:border-blue-500/50">
            <div className="flex min-w-0 flex-1 items-center md:w-80">
              <Search className="ml-3 size-4 shrink-0 text-foreground transition-colors group-focus-within:text-blue-500" />
              <input
                type="text"
                placeholder="Search all transactions..."
                value={pendingSearchTerm}
                onChange={e => setPendingSearchTerm(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleServerSearch() }}
                className="min-w-0 flex-1 bg-transparent px-2.5 py-2.5 text-xs text-foreground outline-none placeholder:text-foreground/60"
              />
              {pendingSearchTerm && (
                <button
                  type="button"
                  onClick={() => setPendingSearchTerm('')}
                  aria-label="Clear search"
                  className="mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-muted transition cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={handleServerSearch}
              disabled={serverIsFetching}
              className="flex min-h-10 shrink-0 items-center justify-center gap-1.5 border-l border-border/50 bg-gradient-to-r from-blue-600 to-blue-500 px-3.5 py-2.5 text-xs font-semibold text-white whitespace-nowrap transition duration-200 hover:from-blue-700 hover:to-blue-600 active:from-blue-800 active:to-blue-700 disabled:opacity-50 cursor-pointer md:px-5"
            >
              {serverIsFetching
                ? <Loader2 className="size-3.5 animate-spin" />
                : <Search className="size-3.5" />}
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        ) : (
          /* Client mode: live-filtering search input with a clear affordance. */
          <div className="group relative flex-1 md:w-72 md:flex-initial">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-blue-500" />
            <input
              type="text"
              placeholder="Search description, category..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-border/70 bg-background py-2.5 pl-9 pr-9 text-xs shadow-sm outline-none transition duration-200 hover:border-border focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/25"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Dropdown Multi-Select Category Filter */}
        <div className="relative ledger-filter-dropdown shrink-0 flex justify-end">
          <button
            onClick={() => setIsFilterDropdownOpen(prev => !prev)}
            className="relative flex items-center justify-center md:justify-between gap-2 shrink-0 px-3 md:px-4 py-2.5 md:w-60 text-xs font-semibold bg-background border border-border/60 rounded-xl hover:bg-muted transition duration-200 cursor-pointer select-none"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <Filter className="size-4 md:size-3.5" />
              <span className="hidden md:inline truncate">
                {showAllCycles
                  ? (appliedFilters.length === 0 ? 'Filters' : `${appliedFilters.length} filter${appliedFilters.length > 1 ? 's' : ''} applied`)
                  : (selectedFilters.length === 0 ? 'Filters' : `${selectedFilters.length} filter${selectedFilters.length > 1 ? 's' : ''} active`)}
              </span>
            </span>
            <span className="hidden md:inline text-[9px] text-muted-foreground">{'▼'}</span>
            {(showAllCycles ? appliedFilters.length : selectedFilters.length) > 0 && (
              <span className="md:hidden absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-bold">
                {showAllCycles ? appliedFilters.length : selectedFilters.length}
              </span>
            )}
          </button>

          {/* Desktop Filter Popover */}
          {isFilterDropdownOpen && (
            <div className="hidden md:block absolute right-0 top-full mt-1.5 w-64 bg-card border border-border rounded-2xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-3">
                <span className="text-xs font-bold text-foreground">Filter Ledger Entries</span>
                {(showAllCycles ? pendingFilters : selectedFilters).length > 0 && (
                  <button
                    onClick={handleClearFilters}
                    className="text-[9px] font-bold text-orange-500 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Scrollable sections */}
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {/* Section 1: Ledger Allocation Buckets */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Ledger Categories</span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {['Essentials', 'Growth', 'Stability', 'Rewards', 'Income'].map(bucket => {
                      const isChecked = (showAllCycles ? pendingFilters : selectedFilters).includes(bucket)
                      return (
                        <label 
                          key={bucket} 
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition ${getCategoryFilterClass(bucket, isChecked)}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleFilter(bucket)}
                            className="rounded border-border text-blue-500 focus:ring-blue-500 size-3"
                          />
                          <span className={`size-2 rounded-full ${getCategoryDotClass(bucket)}`} />
                          <span>{bucket}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Section 2: Transaction Categories */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Categories</span>
                  <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-0.5">
                    {categories.map(c => {
                      const isChecked = (showAllCycles ? pendingFilters : selectedFilters).includes(c.name)
                      return (
                        <label 
                          key={c.id} 
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition ${getCategoryFilterClass(c.name, isChecked)}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleFilter(c.name)}
                            className="rounded border-border text-blue-500 focus:ring-blue-500 size-3"
                          />
                          <span className={`size-2 rounded-full ${getCategoryDotClass(c.name)}`} />
                          <span className="truncate">{c.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Apply button -- only in server mode */}
              {showAllCycles && (
                <div className="pt-3 mt-3 border-t border-border/40">
                  <button
                    onClick={handleApplyFilters}
                    disabled={serverIsFetching}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs cursor-pointer transition duration-200 disabled:opacity-50
                      bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600
                      text-white shadow-md shadow-blue-600/20 hover:shadow-blue-600/30"
                  >
                    {serverIsFetching
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Filter className="size-3.5" />}
                    Apply Filters
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile BottomSheet Filter */}
          {isMobile && (
            <BottomSheet
              isOpen={isFilterDropdownOpen}
              title="Filter Ledger Entries"
              onClose={() => setIsFilterDropdownOpen(false)}
              footer={showAllCycles ? (
                <button
                  onClick={() => {
                    handleApplyFilters()
                    setIsFilterDropdownOpen(false)
                  }}
                  disabled={serverIsFetching}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs cursor-pointer transition duration-200 disabled:opacity-50
                    bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600
                    text-white shadow-md shadow-blue-600/20 hover:shadow-blue-600/30"
                >
                  {serverIsFetching
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : <Filter className="size-3.5" />}
                  Apply Filters
                </button>
              ) : undefined}
            >
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {(showAllCycles ? pendingFilters : selectedFilters).length > 0 && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleClearFilters}
                      className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                )}

                {/* Section 1: Ledger Allocation Buckets */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Ledger Categories</span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {['Essentials', 'Growth', 'Stability', 'Rewards', 'Income'].map(bucket => {
                      const isChecked = (showAllCycles ? pendingFilters : selectedFilters).includes(bucket)
                      return (
                        <label 
                          key={bucket} 
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer select-none transition ${getCategoryFilterClass(bucket, isChecked)}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleFilter(bucket)}
                            className="rounded border-border text-blue-500 focus:ring-blue-500 size-3.5"
                          />
                          <span className={`size-2.5 rounded-full ${getCategoryDotClass(bucket)}`} />
                          <span className="font-semibold">{bucket}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Section 2: Transaction Categories */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Categories</span>
                  <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                    {categories.map(c => {
                      const isChecked = (showAllCycles ? pendingFilters : selectedFilters).includes(c.name)
                      return (
                        <label 
                          key={c.id} 
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer select-none transition ${getCategoryFilterClass(c.name, isChecked)}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleFilter(c.name)}
                            className="rounded border-border text-blue-500 focus:ring-blue-500 size-3.5"
                          />
                          <span className={`size-2.5 rounded-full ${getCategoryDotClass(c.name)}`} />
                          <span className="font-semibold truncate">{c.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            </BottomSheet>
          )}
        </div>
      </div>

      {/* Ledger Table - Desktop */}
      <div className="hidden md:block overflow-hidden border border-border/60 rounded-2xl bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20 text-xs font-semibold text-muted-foreground select-none">
                <th className="p-4">Date</th>
                <th className="p-4">Description</th>
                <th className="p-4">Category</th>
                <th className="p-4">Ledger Category</th>
                <th className="p-4 text-right text-orange-500/90 font-bold">Debit (Outflow)</th>
                <th className="p-4 text-right text-emerald-500/90 font-bold">Credit (Inflow)</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <motion.tbody
              key={`${selectedMonth}-${selectedYear}-${showAllCycles}-${currentPage}`}
              initial="hidden" animate="show"
              variants={listContainerVariants}
              className="divide-y divide-border/30 text-xs"
            >
              <AnimatePresence>
              {displayTransactions.map(t => (
                <DesktopLedgerRow
                  key={t.id}
                  transaction={t}
                  isDeleting={isTxDeleting(t.id)}
                  isSyncing={isTxSyncing(t.id)}
                  hideSensitive={hideSensitive}
                  currency={currency}
                  onStartEdit={onStartEditStable}
                  onDeleteClick={onDeleteClickStable}
                  onSplitEditBlocked={onSplitEditBlockedStable}
                />
              ))}
              {displayTransactions.length > 0 && (
                <tr className="bg-muted/25 font-bold border-t-2 border-border text-xs select-none">
                  <td className="p-4 uppercase tracking-wider text-foreground font-extrabold" colSpan={4}>
                    Page Total <span className="text-muted-foreground font-bold normal-case tracking-normal">({displayTransactions.length} items)</span>
                  </td>
                  {/* Wrapped in the same pill shape as the row values so the totals line up exactly
                      under each column (plain text sat ~0.6rem further right than the pill text),
                      with a ring + stronger fill to read clearly as the column total. */}
                  <td className="p-4 text-right">
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-orange-500/15 ring-1 ring-inset ring-orange-500/40 text-orange-500 font-extrabold text-xs">
                      {formatSensitive(pageTotals.outflow)}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/40 text-emerald-500 font-extrabold text-xs">
                      {formatSensitive(pageTotals.inflow)}
                    </span>
                  </td>
                  <td className="p-4"></td>
                </tr>
              )}
              </AnimatePresence>

              {displayTransactions.length === 0 && (
                <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                    {serverIsFetching ? 'Loading...' : 'No transactions match your search or filter criteria.'}
                  </td>
                </motion.tr>
              )}
            </motion.tbody>
          </table>
        </div>
      </div>

      {/* Ledger List - Mobile (swipe a row left to reveal Edit / Delete) */}
      <motion.div
        key={`${selectedMonth}-${selectedYear}-${showAllCycles}-${currentPage}`}
        initial="hidden" animate="show"
        variants={listContainerVariants}
        className="block md:hidden space-y-3"
      >
        <AnimatePresence>
        {displayTransactions.map((t, idx) => (
          <MobileLedgerRow
            key={t.id}
            transaction={t}
            hint={idx === 0}
            isDeleting={isTxDeleting(t.id)}
            isSyncing={isTxSyncing(t.id)}
            hideSensitive={hideSensitive}
            currency={currency}
            onStartEdit={onStartEditStable}
            onDeleteClick={onDeleteClickStable}
            onSplitEditBlocked={onSplitEditBlockedStable}
          />
        ))}
        {displayTransactions.length > 0 && (
          <div className="flex flex-col gap-2.5 p-4 bg-card border border-border/60 rounded-xl text-xs shadow-xs select-none">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Page Total Summary</div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-semibold">Total Outflow (Debit)</span>
              <span className="text-orange-500 font-bold text-sm">{formatSensitive(pageTotals.outflow)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-border/30 pt-2.5">
              <span className="text-muted-foreground font-semibold">Total Inflow (Credit)</span>
              <span className="text-emerald-500 font-bold text-sm">{formatSensitive(pageTotals.inflow)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-border/50 pt-2.5 font-bold">
              <span className="text-foreground">Net Position</span>
              <span className={`${pageTotals.inflow - pageTotals.outflow >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                {pageTotals.inflow - pageTotals.outflow >= 0 ? '+' : '-'}
                {formatSensitive(Math.abs(pageTotals.inflow - pageTotals.outflow))}
              </span>
            </div>
          </div>
        )}
        </AnimatePresence>

        {displayTransactions.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 text-center text-muted-foreground text-sm border rounded-xl bg-card">
            {serverIsFetching ? 'Loading...' : 'No transactions match your criteria.'}
          </motion.div>
        )}
      </motion.div>

      {/* Unified Pagination Controls */}
      {(() => {
        const isServerMode = showAllCycles && !!serverResult
        const displayTotal = isServerMode ? serverResult!.total : filteredTransactions.length
        const displayTotalPages = isServerMode
          ? Math.ceil(serverResult!.total / pageSize) || 1
          : totalPages
        const displayFrom = (currentPage - 1) * pageSize + 1
        const displayTo = Math.min(currentPage * pageSize, displayTotal)
        if (displayTotal === 0) return null
        return (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-card border border-border/60 rounded-2xl shadow-xs text-xs select-none">
            <div className="text-muted-foreground font-medium flex items-center gap-2">
              {isServerMode && serverIsFetching && <Loader2 className="size-3.5 animate-spin text-blue-500" />}
              Showing <span className="text-foreground font-semibold">{displayFrom}</span> to{' '}
              <span className="text-foreground font-semibold">{displayTo}</span>{' '}
              of <span className="text-foreground font-semibold">{displayTotal}</span> entries
            </div>
            
            <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Page size select dropdown selector */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">Rows per page:</span>
                <CustomSelect
                  value={pageSize}
                  onChange={(val) => {
                    setPageSize(Number(val))
                    setCurrentPage(1)
                  }}
                  options={[
                    { value: 10, label: '10' },
                    { value: 25, label: '25' },
                    { value: 50, label: '50' },
                    { value: 100, label: '100' }
                  ]}
                  className="w-24"
                  direction="up"
                />
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 sm:hidden">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || serverIsFetching}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer transition"
                  >
                    Prev
                  </button>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Page {currentPage} / {displayTotalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, displayTotalPages))}
                    disabled={currentPage === displayTotalPages || serverIsFetching}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer transition"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || serverIsFetching}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer transition"
                  >
                    Previous
                  </button>
                  {renderPageNumbers(displayTotalPages)}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, displayTotalPages))}
                    disabled={currentPage === displayTotalPages || serverIsFetching}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <BottomSheet
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        maxWidthClassName="max-w-md"
        title={
          <span className="flex items-center gap-2 text-blue-500">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
              <Download className="size-5" />
            </span>
            <span className="text-foreground">Export Ledger CSV</span>
          </span>
        }
      >
        <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
          <p>
            Choose whether to export the current page or the full result set based on your active filters.
          </p>
          <p className="text-[10px] text-muted-foreground/80">
            Full exports use a server-side download to avoid large client loads.
          </p>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <button
            type="button"
            onClick={handleExportPage}
            disabled={exportIsFetching}
            className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted text-foreground transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export This Page
          </button>
          <button
            type="button"
            onClick={handleExportAll}
            disabled={exportIsFetching}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {exportIsFetching && <Loader2 className="size-3.5 animate-spin" />}
            Export Entire Result
          </button>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowExportModal(false)}
            disabled={exportIsFetching}
            className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted text-foreground transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>


      {showDeleteModal && txToDelete && (
        <BottomSheet
          isOpen={showDeleteModal}
          onClose={handleCancelDelete}
          maxWidthClassName="max-w-md"
          title={
            <div className="flex items-center gap-2 text-orange-500">
              <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500">
                <AlertCircle className="size-5" />
              </span>
              <span>Confirm Deletion</span>
            </div>
          }
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted text-foreground transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          }
        >
            <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              {txToDelete.id.includes('-split-') ? (
                <p>
                  This transaction is a <span className="font-semibold text-foreground">split transfer sub-record</span> of an Income Auto-Split. Deleting it will delete the main Income record and all other category splits associated with it.
                </p>
              ) : (txToDelete.ledgerCategory === 'Income' || (txToDelete.ledgerCategory || '').startsWith('IncomeSplit:')) ? (
                <p>
                  This is the <span className="font-semibold text-foreground">main Income Auto-Split record</span>. Deleting it will delete all its associated category sub-split records as well.
                </p>
              ) : (
                <p>
                  Are you sure you want to delete this transaction: <span className="font-semibold text-foreground">"{txToDelete.description}"</span> of <span className="font-bold text-foreground">{formatSensitive(txToDelete.amount)}</span>?
                </p>
              )}
              <p className="text-[10px] text-orange-500/90 font-medium bg-orange-500/5 p-2 rounded-lg border border-orange-500/10">
                Are you sure you want to delete this transaction?
              </p>
            </div>
        </BottomSheet>
      )}

      {showEditDisabledModal && (
        <BottomSheet
          isOpen={showEditDisabledModal}
          onClose={() => setShowEditDisabledModal(false)}
          maxWidthClassName="max-w-md"
          title={
            <div className="flex items-center gap-2 text-blue-500">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                <AlertCircle className="size-5" />
              </span>
              <span>Editing Disabled</span>
            </div>
          }
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditDisabledModal(false)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
              >
                Close
              </button>
            </div>
          }
        >
            <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                This transaction is a <span className="font-semibold text-foreground">split transfer sub-record</span> generated automatically from an Income Auto-Split.
              </p>
              <p>
                To edit this transaction's amount, description, or split allocations, please find and edit the main <span className="font-semibold text-foreground">Income (Auto-Split)</span> record.
              </p>
            </div>
        </BottomSheet>
      )}
    </div>
  )
}
