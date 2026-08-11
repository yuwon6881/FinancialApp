import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import * as api from './api'
import type { ReceiptScanResult } from './api'
import type { AppTab } from '../types'
import type { ToastAction, ToastTone } from '../components/ui/ToastViewport'
import { errorMessageIncludes, errorMessageIncludesLower } from './errors'
import { scanReviewAction } from './scanReviewAction'

const RECEIPT_SCAN_JOB_IDS_KEY = 'receipt_scan_job_ids'
const RECEIPT_SCAN_NOTIFIED_IDS_KEY = 'receipt_scan_notified_ids'

function readStoredIds(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

function storeIds(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch (err) {
    console.warn(`Failed to persist ${key}`, err)
  }
}

interface ReceiptScanDraft {
  jobId: string
  result: ReceiptScanResult
}

interface FailedScanJob {
  jobId: string
  errorMessage: string
}

export interface UseReceiptScanPollingOptions {
  token: string | null
  /** Ref to the currently-active tab (kept as a ref to avoid re-subscribing). */
  activeTabRef: MutableRefObject<AppTab>
  /** Ref to whether the Ledger add-transaction modal is open. */
  isLedgerAddOpenRef: MutableRefObject<boolean>
  setActiveTab: (tab: AppTab) => void
  setAutoOpenLedgerAdd: (open: boolean) => void
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
}

export interface UseReceiptScanPollingResult {
  activeReceiptScanDraft: ReceiptScanDraft | null
  failedScanJob: FailedScanJob | null
  receiptScanJobIds: string[]
  handleReceiptScanStarted: (scanId: string) => void
  clearReceiptScanJob: (scanId: string) => Promise<void>
}

/**
 * Owns the background receipt-scan (OCR) job lifecycle: persistence of tracked
 * job ids, polling the backend every 3s while any job is outstanding, surfacing
 * completed drafts / failures, and one-shot success toasts. Lifted verbatim out
 * of App.tsx; cross-cutting tab/modal refs and the toast fn are injected.
 */
export function useReceiptScanPolling(options: UseReceiptScanPollingOptions): UseReceiptScanPollingResult {
  const { token, activeTabRef, isLedgerAddOpenRef, setActiveTab, setAutoOpenLedgerAdd, showToast } = options

  const [receiptScanJobIds, setReceiptScanJobIds] = useState<string[]>(() => readStoredIds(RECEIPT_SCAN_JOB_IDS_KEY))
  const receiptScanJobIdsRef = useRef(receiptScanJobIds)
  const [notifiedReceiptScanJobIds, setNotifiedReceiptScanJobIds] = useState<string[]>(() => readStoredIds(RECEIPT_SCAN_NOTIFIED_IDS_KEY))
  const [activeReceiptScanDraft, setActiveReceiptScanDraft] = useState<ReceiptScanDraft | null>(null)
  const [failedScanJob, setFailedScanJob] = useState<FailedScanJob | null>(null)
  const receiptScanDeletePromisesRef = useRef<Map<string, Promise<void>>>(new Map())
  const deletedReceiptScanJobIdsRef = useRef<Set<string>>(new Set())

  const updateReceiptScanJobIds = useCallback((update: (current: string[]) => string[]) => {
    const next = update(receiptScanJobIdsRef.current)
    receiptScanJobIdsRef.current = next
    setReceiptScanJobIds(next)
    // Persist synchronously so a consumed result cannot be restored if the app
    // closes before React has a chance to run a persistence effect.
    storeIds(RECEIPT_SCAN_JOB_IDS_KEY, next)
  }, [])

  useEffect(() => {
    storeIds(RECEIPT_SCAN_NOTIFIED_IDS_KEY, notifiedReceiptScanJobIds)
  }, [notifiedReceiptScanJobIds])

  const handleReceiptScanStarted = useCallback((scanId: string) => {
    deletedReceiptScanJobIdsRef.current.delete(scanId)
    setFailedScanJob(null)
    updateReceiptScanJobIds(prev => prev.includes(scanId) ? prev : [...prev, scanId])
  }, [updateReceiptScanJobIds])

  const removeReceiptScanJobState = useCallback((scanId: string, clearFailure: boolean) => {
    updateReceiptScanJobIds(prev => prev.filter(id => id !== scanId))
    setNotifiedReceiptScanJobIds(prev => prev.filter(id => id !== scanId))
    setActiveReceiptScanDraft(prev => prev?.jobId === scanId ? null : prev)
    if (clearFailure) {
      setFailedScanJob(prev => prev?.jobId === scanId ? null : prev)
    }
  }, [updateReceiptScanJobIds])

  const deleteReceiptScanJobOnce = useCallback((scanId: string): Promise<void> => {
    if (deletedReceiptScanJobIdsRef.current.has(scanId)) {
      return Promise.resolve()
    }

    const inFlight = receiptScanDeletePromisesRef.current.get(scanId)
    if (inFlight) return inFlight

    const request = (async () => {
      try {
        await api.deleteReceiptScanJob(scanId)
        deletedReceiptScanJobIdsRef.current.add(scanId)
      } catch (err) {
        console.warn('Failed to delete receipt scan job', err)
      } finally {
        receiptScanDeletePromisesRef.current.delete(scanId)
      }
    })()

    receiptScanDeletePromisesRef.current.set(scanId, request)
    return request
  }, [])

  const clearReceiptScanJob = useCallback(async (scanId: string) => {
    removeReceiptScanJobState(scanId, true)
    await deleteReceiptScanJobOnce(scanId)
  }, [deleteReceiptScanJobOnce, removeReceiptScanJobState])

  const receiptScanPollInFlightRef = useRef(false)

  useEffect(() => {
    if (!token || receiptScanJobIds.length === 0) return

    let cancelled = false

    const pollReceiptScans = async () => {
      if (receiptScanPollInFlightRef.current) return
      receiptScanPollInFlightRef.current = true

      try {
        for (const scanId of receiptScanJobIds) {
          if (cancelled || activeReceiptScanDraft?.jobId === scanId) continue

          try {
            const job = await api.fetchReceiptScanJob(scanId)
            if (cancelled || !receiptScanJobIdsRef.current.includes(scanId)) {
              continue
            }

            if (job.status === 'failed') {
              const errMsg = job.errorMessage || 'Receipt scan failed. Please try again.'
              setFailedScanJob({ jobId: scanId, errorMessage: errMsg })

              const isInModal = activeTabRef.current === 'ledger' && isLedgerAddOpenRef.current
              if (!isInModal) {
                showToast(errMsg, 'Receipt Scan Failed', 'error')
              }
              // Stop tracking and delete the failed backend job, but keep the
              // failure signal long enough for an open form to render it.
              removeReceiptScanJobState(scanId, false)
              await deleteReceiptScanJobOnce(scanId)
              continue
            }

            if (job.status === 'completed' && job.result) {
              setActiveReceiptScanDraft({ jobId: scanId, result: job.result })

              const isInModal = activeTabRef.current === 'ledger' && isLedgerAddOpenRef.current
              if (!isInModal) {
                if (!notifiedReceiptScanJobIds.includes(scanId)) {
                  setNotifiedReceiptScanJobIds(prev => prev.includes(scanId) ? prev : [...prev, scanId])
                  showToast('Receipt was scanned successfully.', 'Receipt Scan Completed', 'success', scanReviewAction(setActiveTab, setAutoOpenLedgerAdd, 'ledger'))
                }
              }
            }
          } catch (err: unknown) {
            if (errorMessageIncludes(err, '401') || errorMessageIncludes(err, '423')) {
              continue
            }
            if (errorMessageIncludesLower(err, 'not found')) {
              removeReceiptScanJobState(scanId, true)
            }
          }
        }
      } finally {
        receiptScanPollInFlightRef.current = false
      }
    }

    pollReceiptScans()
    const interval = window.setInterval(pollReceiptScans, 3000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [token, receiptScanJobIds, notifiedReceiptScanJobIds, activeReceiptScanDraft, deleteReceiptScanJobOnce, removeReceiptScanJobState, activeTabRef, isLedgerAddOpenRef, setActiveTab, setAutoOpenLedgerAdd, showToast])

  return {
    activeReceiptScanDraft,
    failedScanJob,
    receiptScanJobIds,
    handleReceiptScanStarted,
    clearReceiptScanJob,
  }
}
