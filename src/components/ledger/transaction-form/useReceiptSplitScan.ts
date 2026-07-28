import { useCallback, useEffect, useRef, useState } from 'react'
import { startReceiptSplitScan } from '../../../lib/api'
import { getErrorMessage } from '../../../lib/errors'
import type { ReceiptSplitDraft, ReceiptSplitFailure } from '../../../lib/useReceiptSplitPolling'

export interface UseReceiptSplitScanOptions {
  receiptSplitDraft?: ReceiptSplitDraft | null
  failedReceiptSplitJob?: ReceiptSplitFailure | null
  onReceiptSplitStarted?: (scanId: string) => void
  /** Surfaces a start/scan failure where the plain receipt scan's error is shown. */
  onError: (message: string) => void
}

/**
 * Shared-receipt scanning started from the transaction form. Deliberately a
 * sibling of useReceiptScanDraft rather than part of it: the split scan feeds the
 * split editor sheet, never the form's own fields, so the only state it owns is
 * the picker and the in-flight job. The editor opens from the polled draft, so
 * this hook stops spinning as soon as its job resolves either way.
 */
export function useReceiptSplitScan(options: UseReceiptSplitScanOptions) {
  const { receiptSplitDraft, failedReceiptSplitJob, onReceiptSplitStarted, onError } = options

  const [isScanning, setIsScanning] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const handleScan = useCallback(async (file: File) => {
    setIsScanning(true)
    try {
      const started = await startReceiptSplitScan(file)
      setActiveJobId(started.scanId)
      onReceiptSplitStarted?.(started.scanId)
    } catch (error: unknown) {
      setIsScanning(false)
      onError(getErrorMessage(error, 'Could not scan this receipt. Please try a clearer photo.'))
    } finally {
      // Re-selecting the same file must fire another change event.
      if (cameraInputRef.current) cameraInputRef.current.value = ''
      if (galleryInputRef.current) galleryInputRef.current.value = ''
    }
  }, [onError, onReceiptSplitStarted])

  useEffect(() => {
    if (!activeJobId) return
    if (receiptSplitDraft?.jobId === activeJobId) {
      setIsScanning(false)
      setActiveJobId(null)
      return
    }
    if (failedReceiptSplitJob?.jobId === activeJobId) {
      setIsScanning(false)
      setActiveJobId(null)
      onError(failedReceiptSplitJob.errorMessage)
    }
  }, [activeJobId, receiptSplitDraft, failedReceiptSplitJob, onError])

  return {
    isScanning,
    showPicker,
    setShowPicker,
    cameraInputRef,
    galleryInputRef,
    handleScan,
  }
}
