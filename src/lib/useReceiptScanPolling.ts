import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import * as api from './api'
import type { ReceiptScanResult } from './api'
import type { AppTab } from '../types'
import type { ToastTone } from '../components/ui/ToastViewport'
import { errorMessageIncludes, errorMessageIncludesLower } from './errors'

export interface ReceiptScanDraft {
  jobId: string
  result: ReceiptScanResult
}

export interface FailedScanJob {
  jobId: string
  errorMessage: string
}

export interface UseReceiptScanPollingOptions {
  token: string | null
  /** Ref to the currently-active tab (kept as a ref to avoid re-subscribing). */
  activeTabRef: MutableRefObject<AppTab>
  /** Ref to whether the Ledger add-transaction modal is open. */
  isLedgerAddOpenRef: MutableRefObject<boolean>
  /** Ref guarding against setState after unmount. */
  isMountedRef: MutableRefObject<boolean>
  setActiveTab: (tab: AppTab) => void
  setAutoOpenLedgerAdd: (open: boolean) => void
  showToast: (message: string, title?: string, tone?: ToastTone) => void
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
  const { token, activeTabRef, isLedgerAddOpenRef, isMountedRef, setActiveTab, setAutoOpenLedgerAdd, showToast } = options

  const [receiptScanJobIds, setReceiptScanJobIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('receipt_scan_job_ids') || '[]')
    } catch {
      return []
    }
  })
  const [notifiedReceiptScanJobIds, setNotifiedReceiptScanJobIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('receipt_scan_notified_ids') || '[]')
    } catch {
      return []
    }
  })
  const [activeReceiptScanDraft, setActiveReceiptScanDraft] = useState<ReceiptScanDraft | null>(null)
  const [failedScanJob, setFailedScanJob] = useState<FailedScanJob | null>(null)

  useEffect(() => {
    localStorage.setItem('receipt_scan_job_ids', JSON.stringify(receiptScanJobIds))
  }, [receiptScanJobIds])

  useEffect(() => {
    localStorage.setItem('receipt_scan_notified_ids', JSON.stringify(notifiedReceiptScanJobIds))
  }, [notifiedReceiptScanJobIds])

  const handleReceiptScanStarted = useCallback((scanId: string) => {
    setReceiptScanJobIds(prev => prev.includes(scanId) ? prev : [...prev, scanId])
  }, [])

  const clearReceiptScanJob = useCallback(async (scanId: string) => {
    setReceiptScanJobIds(prev => prev.filter(id => id !== scanId))
    setNotifiedReceiptScanJobIds(prev => prev.filter(id => id !== scanId))
    setActiveReceiptScanDraft(prev => prev?.jobId === scanId ? null : prev)
    setFailedScanJob(prev => prev?.jobId === scanId ? null : prev)

    try {
      await api.deleteReceiptScanJob(scanId)
    } catch (err) {
      console.warn('Failed to delete receipt scan job', err)
    }
  }, [])

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

            if (job.status === 'failed') {
              const errMsg = job.errorMessage || 'Receipt scan failed. Please try again.'
              setFailedScanJob({ jobId: scanId, errorMessage: errMsg })

              const isInModal = activeTabRef.current === 'ledger' && isLedgerAddOpenRef.current
              if (!isInModal) {
                showToast(errMsg, 'Receipt Scan Failed', 'error')
              }
              await clearReceiptScanJob(scanId)
              continue
            }

            if (job.status === 'completed' && job.result) {
              setActiveReceiptScanDraft({ jobId: scanId, result: job.result })

              const isInModal = activeTabRef.current === 'ledger' && isLedgerAddOpenRef.current
              if (!isInModal) {
                if (!notifiedReceiptScanJobIds.includes(scanId)) {
                  setNotifiedReceiptScanJobIds(prev => prev.includes(scanId) ? prev : [...prev, scanId])
                  showToast('Your receipt has been scanned successfully.', 'Receipt Scan Complete', 'success')
                }

                window.setTimeout(() => {
                  if (!isMountedRef.current) return
                  setActiveTab('ledger')
                  setAutoOpenLedgerAdd(true)
                }, 1000)
              }
            }
          } catch (err: unknown) {
            if (errorMessageIncludes(err, '401') || errorMessageIncludes(err, '423')) {
              continue
            }
            if (errorMessageIncludesLower(err, 'not found')) {
              setReceiptScanJobIds(prev => prev.filter(id => id !== scanId))
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
  }, [token, receiptScanJobIds, notifiedReceiptScanJobIds, activeReceiptScanDraft, clearReceiptScanJob, activeTabRef, isLedgerAddOpenRef, isMountedRef, setActiveTab, setAutoOpenLedgerAdd, showToast])

  return {
    activeReceiptScanDraft,
    failedScanJob,
    receiptScanJobIds,
    handleReceiptScanStarted,
    clearReceiptScanJob,
  }
}
