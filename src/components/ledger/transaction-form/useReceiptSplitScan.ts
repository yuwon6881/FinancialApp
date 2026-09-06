import { useCallback, useEffect, useRef, useState } from 'react'
import { startReceiptSplitScan } from '../../../lib/api'
import { getErrorMessage } from '../../../lib/errors'
import type { ReceiptSplitDraft, ReceiptSplitFailure } from '../../../lib/useReceiptSplitPolling'

export interface UseReceiptSplitScanOptions {
  receiptSplitDraft?: ReceiptSplitDraft | null
  failedReceiptSplitJob?: ReceiptSplitFailure | null
  onReceiptSplitStarted?: (scanId: string) => void
  /** Opens the split editor on the scan this form is waiting for, the moment it lands. */
  onReviewDraft: () => void
  /**
   * Hands the announcement back when this form can no longer open the editor itself, so a scan
   * outlived by its form still reaches the user through the completion toast.
   */
  onReleaseReview?: (scanId: string) => void
  /** Surfaces a start/scan failure where the plain receipt scan's error is shown. */
  onError: (message: string) => void
}

/**
 * Shared-receipt scanning started from the transaction form. Deliberately a
 * sibling of useReceiptScanDraft rather than part of it: the split scan feeds the
 * split editor sheet, never the form's own fields, so the only state it owns is
 * the picker and the in-flight job. This hook stops spinning as soon as its job
 * resolves either way, and opens the editor itself when it resolves with a result.
 */
export function useReceiptSplitScan(options: UseReceiptSplitScanOptions) {
  const {
    receiptSplitDraft,
    failedReceiptSplitJob,
    onReceiptSplitStarted,
    onReviewDraft,
    onReleaseReview,
    onError,
  } = options

  const [isScanning, setIsScanning] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [activeJobId, setActiveJobIdState] = useState<string | null>(null)
  const activeJobIdRef = useRef<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const setActiveJobId = useCallback((scanId: string | null) => {
    // Kept in a ref as well so the unmount handler below can see the in-flight job without
    // re-running — and therefore without releasing the announcement on every job change.
    activeJobIdRef.current = scanId
    setActiveJobIdState(scanId)
  }, [])

  const onReleaseReviewRef = useRef(onReleaseReview)
  useEffect(() => {
    onReleaseReviewRef.current = onReleaseReview
  }, [onReleaseReview])

  useEffect(() => () => {
    const pending = activeJobIdRef.current
    if (pending) onReleaseReviewRef.current?.(pending)
  }, [])

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
  }, [onError, onReceiptSplitStarted, setActiveJobId])

  useEffect(() => {
    if (!activeJobId) return
    if (receiptSplitDraft?.jobId === activeJobId) {
      setIsScanning(false)
      setActiveJobId(null)
      onReviewDraft()
      return
    }
    if (failedReceiptSplitJob?.jobId === activeJobId) {
      setIsScanning(false)
      setActiveJobId(null)
      onError(failedReceiptSplitJob.errorMessage)
    }
  }, [activeJobId, receiptSplitDraft, failedReceiptSplitJob, onError, onReviewDraft, setActiveJobId])

  return {
    isScanning,
    showPicker,
    setShowPicker,
    cameraInputRef,
    galleryInputRef,
    handleScan,
  }
}
