import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import * as api from './api'
import type { ReceiptSplitScanResult } from './api'
import type { AppTab } from '../types'
import type { ToastAction, ToastTone } from '../components/ui/ToastViewport'
import { errorMessageIncludes, errorMessageIncludesLower } from './errors'
import { scanReviewAction } from './scanReviewAction'

const JOB_IDS_KEY = 'receipt_split_scan_job_ids'
const NOTIFIED_IDS_KEY = 'receipt_split_scan_notified_ids'

function readStoredIds(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function storeIds(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch (error) {
    console.warn(`Failed to persist ${key}`, error)
  }
}

export interface ReceiptSplitDraft {
  jobId: string
  result: ReceiptSplitScanResult
}

export interface ReceiptSplitFailure {
  jobId: string
  errorMessage: string
}

interface Options {
  token: string | null
  isReceiptSplitOpenRef: MutableRefObject<boolean>
  setActiveTab: (tab: AppTab) => void
  setAutoOpenReceiptSplit: (open: boolean) => void
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
}

export function useReceiptSplitPolling(options: Options) {
  const {
    token,
    isReceiptSplitOpenRef,
    setActiveTab,
    setAutoOpenReceiptSplit,
    showToast,
  } = options
  const [jobIds, setJobIds] = useState<string[]>(() => readStoredIds(JOB_IDS_KEY))
  const jobIdsRef = useRef(jobIds)
  const [notifiedIds, setNotifiedIds] = useState<string[]>(() => readStoredIds(NOTIFIED_IDS_KEY))
  const [activeDraft, setActiveDraft] = useState<ReceiptSplitDraft | null>(null)
  const [failedJob, setFailedJob] = useState<ReceiptSplitFailure | null>(null)
  const pollInFlightRef = useRef(false)
  const deletePromisesRef = useRef<Map<string, Promise<void>>>(new Map())

  const updateIds = useCallback((update: (current: string[]) => string[]) => {
    const next = update(jobIdsRef.current)
    jobIdsRef.current = next
    setJobIds(next)
    storeIds(JOB_IDS_KEY, next)
  }, [])

  useEffect(() => {
    storeIds(NOTIFIED_IDS_KEY, notifiedIds)
  }, [notifiedIds])

  const handleStarted = useCallback((scanId: string) => {
    setFailedJob(null)
    updateIds(current => current.includes(scanId) ? current : [...current, scanId])
  }, [updateIds])

  const deleteOnce = useCallback((scanId: string) => {
    const existing = deletePromisesRef.current.get(scanId)
    if (existing) return existing
    const request = api.deleteReceiptScanJob(scanId)
      .catch(error => console.warn('Failed to delete receipt split scan job', error))
      .finally(() => deletePromisesRef.current.delete(scanId))
    deletePromisesRef.current.set(scanId, request)
    return request
  }, [])

  const clearJob = useCallback(async (scanId: string) => {
    updateIds(current => current.filter(id => id !== scanId))
    setNotifiedIds(current => current.filter(id => id !== scanId))
    setActiveDraft(current => current?.jobId === scanId ? null : current)
    setFailedJob(current => current?.jobId === scanId ? null : current)
    await deleteOnce(scanId)
  }, [deleteOnce, updateIds])

  useEffect(() => {
    if (!token || jobIds.length === 0) return
    let cancelled = false

    const poll = async () => {
      if (pollInFlightRef.current) return
      pollInFlightRef.current = true
      try {
        for (const scanId of jobIds) {
          if (cancelled || activeDraft?.jobId === scanId) continue
          try {
            const job = await api.fetchReceiptSplitScanJob(scanId)
            if (cancelled || !jobIdsRef.current.includes(scanId)) continue
            if (job.status === 'failed') {
              const message = job.errorMessage || 'Receipt split scan failed. Please try again.'
              setFailedJob({ jobId: scanId, errorMessage: message })
              updateIds(current => current.filter(id => id !== scanId))
              setNotifiedIds(current => current.filter(id => id !== scanId))
              if (!isReceiptSplitOpenRef.current)
                showToast(message, 'Receipt Split Failed', 'error')
              await deleteOnce(scanId)
              continue
            }
            if (job.status === 'completed' && job.result) {
              setActiveDraft({ jobId: scanId, result: job.result })
              // Two finished scans take turns being the active draft, so without a
              // one-shot record the same completion toast would fire on every tick.
              if (!isReceiptSplitOpenRef.current && !notifiedIds.includes(scanId)) {
                setNotifiedIds(current => current.includes(scanId) ? current : [...current, scanId])
                showToast('Receipt items were prepared for review.', 'Receipt Split Completed', 'success', scanReviewAction(setActiveTab, setAutoOpenReceiptSplit, 'ledger'))
              }
            }
          } catch (error: unknown) {
            if (errorMessageIncludes(error, '401') || errorMessageIncludes(error, '423')) continue
            if (errorMessageIncludesLower(error, 'not found'))
              updateIds(current => current.filter(id => id !== scanId))
          }
        }
      } finally {
        pollInFlightRef.current = false
      }
    }

    void poll()
    const interval = window.setInterval(poll, 3000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [
    token,
    jobIds,
    notifiedIds,
    activeDraft,
    isReceiptSplitOpenRef,
    setActiveTab,
    setAutoOpenReceiptSplit,
    showToast,
    updateIds,
    deleteOnce,
  ])

  return {
    activeReceiptSplitDraft: activeDraft,
    failedReceiptSplitJob: failedJob,
    receiptSplitJobIds: jobIds,
    handleReceiptSplitStarted: handleStarted,
    clearReceiptSplitJob: clearJob,
  }
}
