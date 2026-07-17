import { useState, useRef, useEffect, useCallback } from 'react'
import { startReceiptScan } from '../../../lib/api'
import { getErrorMessage } from '../../../lib/errors'

export interface UseReceiptScanDraftOptions {
  showAddForm: boolean
  autoOpenAddForm?: boolean
  receiptScanDraft: any
  activeScanJobIds?: string[]
  failedScanJob?: any
  onReceiptScanStarted?: (scanId: string) => void
  onReceiptScanCleared?: (scanId: string) => void | Promise<void>
  applyReceiptScanResult: (result: any) => void
  openTransactionForm: () => void
  onStartEditPending?: (id: string | null) => void
}

export function useReceiptScanDraft(options: UseReceiptScanDraftOptions) {
  const {
    showAddForm,
    autoOpenAddForm,
    receiptScanDraft,
    activeScanJobIds = [],
    failedScanJob,
    onReceiptScanStarted,
    onReceiptScanCleared,
    applyReceiptScanResult,
    openTransactionForm,
    onStartEditPending,
  } = options

  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [showScanBanner, setShowScanBanner] = useState(false)
  const [activeReceiptScanJobId, setActiveReceiptScanJobIdState] = useState<string | null>(null)
  const [showScanPicker, setShowScanPicker] = useState(false)

  const scanFileInputRef = useRef<HTMLInputElement>(null)
  const scanGalleryInputRef = useRef<HTMLInputElement>(null)
  const appliedReceiptScanJobRef = useRef<string | null>(null)
  const locallyStartedReceiptScanJobsRef = useRef<Set<string>>(new Set<string>())
  const activeReceiptScanJobIdRef = useRef<string | null>(null)

  const setActiveReceiptScanJobId = useCallback((scanId: string | null) => {
    activeReceiptScanJobIdRef.current = scanId
    setActiveReceiptScanJobIdState(scanId)
  }, [])

  const clearScan = useCallback(() => {
    setScanError(null)
    setShowScanBanner(false)
    setIsScanning(false)
    const scanJobToClear = activeReceiptScanJobIdRef.current
    // Clear the ref synchronously so repeated close/submit events cannot issue
    // duplicate delete requests before React commits the state update.
    setActiveReceiptScanJobId(null)
    if (scanJobToClear) {
      locallyStartedReceiptScanJobsRef.current.delete(scanJobToClear)
      void onReceiptScanCleared?.(scanJobToClear)
    }
  }, [onReceiptScanCleared, setActiveReceiptScanJobId])

  const handleScanReceipt = useCallback(async (file: File) => {
    setIsScanning(true)
    setScanError(null)
    setShowScanBanner(false)
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
      if (scanFileInputRef.current) scanFileInputRef.current.value = ''
      if (scanGalleryInputRef.current) scanGalleryInputRef.current.value = ''
    }
  }, [onReceiptScanStarted, setActiveReceiptScanJobId])

  useEffect(() => {
    if (!receiptScanDraft) return
    if (appliedReceiptScanJobRef.current === receiptScanDraft.jobId) return

    const isLocallyStarted = locallyStartedReceiptScanJobsRef.current.has(receiptScanDraft.jobId)

    if (!showAddForm && !isLocallyStarted && !autoOpenAddForm) return
    if (showAddForm && !isLocallyStarted && !autoOpenAddForm) return

    appliedReceiptScanJobRef.current = receiptScanDraft.jobId
    // Keep the completed job id until the user submits or cancels so that
    // consuming the draft also clears backend and persisted tracking state.
    setActiveReceiptScanJobId(receiptScanDraft.jobId)
    setIsScanning(false)
    if (onStartEditPending) {
      onStartEditPending(null)
    }
    openTransactionForm()
    applyReceiptScanResult(receiptScanDraft.result)
    setShowScanBanner(true)
  }, [receiptScanDraft, showAddForm, autoOpenAddForm, openTransactionForm, applyReceiptScanResult, onStartEditPending, setActiveReceiptScanJobId])

  useEffect(() => {
    if (failedScanJob && (
      failedScanJob.jobId === activeReceiptScanJobId
      || locallyStartedReceiptScanJobsRef.current.has(failedScanJob.jobId)
    )) {
      setScanError(failedScanJob.errorMessage)
      setIsScanning(false)
      locallyStartedReceiptScanJobsRef.current.delete(failedScanJob.jobId)
      setActiveReceiptScanJobId(null)
      return
    }

    if (!activeReceiptScanJobId) return

    if (
      !activeScanJobIds.includes(activeReceiptScanJobId)
      && receiptScanDraft?.jobId !== activeReceiptScanJobId
    ) {
      setIsScanning(false)
      setActiveReceiptScanJobId(null)
    }
  }, [activeReceiptScanJobId, activeScanJobIds, failedScanJob, receiptScanDraft, setActiveReceiptScanJobId])

  return {
    isScanning,
    setIsScanning,
    scanError,
    setScanError,
    showScanBanner,
    setShowScanBanner,
    activeReceiptScanJobId,
    setActiveReceiptScanJobId,
    showScanPicker,
    setShowScanPicker,
    scanFileInputRef,
    scanGalleryInputRef,
    handleScanReceipt,
    clearScan,
    appliedReceiptScanJobRef,
  }
}
