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
  const [activeReceiptScanJobId, setActiveReceiptScanJobId] = useState<string | null>(null)
  const [showScanPicker, setShowScanPicker] = useState(false)

  const scanFileInputRef = useRef<HTMLInputElement>(null)
  const scanGalleryInputRef = useRef<HTMLInputElement>(null)
  const appliedReceiptScanJobRef = useRef<string | null>(null)
  const locallyStartedReceiptScanJobsRef = useRef<Set<string>>(new Set(null))

  const clearScan = useCallback(() => {
    setScanError(null)
    setShowScanBanner(false)
    const scanJobToClear = activeReceiptScanJobId
    if (scanJobToClear) {
      locallyStartedReceiptScanJobsRef.current.delete(scanJobToClear)
    }
    setActiveReceiptScanJobId(null)
    if (scanJobToClear) {
      void onReceiptScanCleared?.(scanJobToClear)
    }
  }, [activeReceiptScanJobId, onReceiptScanCleared])

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
  }, [onReceiptScanStarted])

  useEffect(() => {
    if (!receiptScanDraft) return
    if (appliedReceiptScanJobRef.current === receiptScanDraft.jobId) return

    const isLocallyStarted = locallyStartedReceiptScanJobsRef.current.has(receiptScanDraft.jobId)

    if (!showAddForm && !isLocallyStarted && !autoOpenAddForm) return
    if (showAddForm && !isLocallyStarted && !autoOpenAddForm) return

    appliedReceiptScanJobRef.current = receiptScanDraft.jobId
    setActiveReceiptScanJobId(null)
    setIsScanning(false)
    if (onStartEditPending) {
      onStartEditPending(null)
    }
    openTransactionForm()
    applyReceiptScanResult(receiptScanDraft.result)
    setShowScanBanner(true)
  }, [receiptScanDraft, showAddForm, autoOpenAddForm, openTransactionForm, applyReceiptScanResult, onStartEditPending])

  useEffect(() => {
    if (!activeReceiptScanJobId) return

    if (failedScanJob && failedScanJob.jobId === activeReceiptScanJobId) {
      setScanError(failedScanJob.errorMessage)
      setIsScanning(false)
      setActiveReceiptScanJobId(null)
      return
    }

    if (!activeScanJobIds.includes(activeReceiptScanJobId)) {
      setIsScanning(false)
      setActiveReceiptScanJobId(null)
    }
  }, [activeReceiptScanJobId, activeScanJobIds, failedScanJob])

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
