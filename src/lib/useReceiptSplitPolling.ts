import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import * as api from './api'
import type { ReceiptSplitScanResult } from './api'
import type { AppTab } from '../types'
import type { ToastAction, ToastTone } from '../components/ui/ToastViewport'
import { errorMessageIncludes, errorMessageIncludesLower } from './errors'
import { readStoredScanJobIds } from './scanJobIds'

const JOB_IDS_KEY = 'receipt_split_scan_job_ids'

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
  const [jobIds, setJobIds] = useState<string[]>(() => readStoredScanJobIds(JOB_IDS_KEY))
  const jobIdsRef = useRef(jobIds)
  /**
   * One-shot record of the completion toasts already raised, and of every result already read
   * back. Both are deliberately per-session: the toast is the only route back to an unconsumed
   * result on a fresh start, so a record that outlived the session left a finished scan stranded
   * until retention deleted it.
   */
  const notifiedRef = useRef(new Set<string>())
  const completedRef = useRef(new Map<string, ReceiptSplitScanResult>())
  /**
   * Scans started in this session that a mounted transaction form is still spinning on. That form
   * opens the editor itself and renders any failure inline, so an announcement for one of these
   * would duplicate what the user is already looking at. A form that unmounts before its scan
   * lands hands the announcement back through `releaseReceiptSplitReview`.
   */
  const awaitingFormRef = useRef(new Set<string>())
  const [activeDraft, setActiveDraftState] = useState<ReceiptSplitDraft | null>(null)
  const activeDraftRef = useRef<ReceiptSplitDraft | null>(null)
  const [failedJob, setFailedJob] = useState<ReceiptSplitFailure | null>(null)
  const pollInFlightRef = useRef(false)
  const deletePromisesRef = useRef<Map<string, Promise<void>>>(new Map())

  const updateIds = useCallback((update: (current: string[]) => string[]) => {
    const next = update(jobIdsRef.current)
    jobIdsRef.current = next
    setJobIds(next)
    storeIds(JOB_IDS_KEY, next)
  }, [])

  const setActiveDraft = useCallback((draft: ReceiptSplitDraft | null) => {
    activeDraftRef.current = draft
    setActiveDraftState(draft)
  }, [])

  /** The oldest tracked scan that has a result waiting, so clearing one reveals the next. */
  const promoteNextDraft = useCallback(() => {
    const nextId = jobIdsRef.current.find(id => completedRef.current.has(id))
    const result = nextId ? completedRef.current.get(nextId) : undefined
    setActiveDraft(nextId && result ? { jobId: nextId, result } : null)
  }, [setActiveDraft])

  /**
   * `awaitedByForm` is what separates a scan the user is watching from one the pending-upload
   * queue finished on its own after a relaunch. Only the first has a form standing by to open the
   * editor and show a failure inline; marking a drained upload the same way would suppress the one
   * announcement that could lead the user back to it.
   */
  const handleStarted = useCallback((scanId: string, awaitedByForm = true) => {
    setFailedJob(null)
    if (awaitedByForm) awaitingFormRef.current.add(scanId)
    updateIds(current => current.includes(scanId) ? current : [...current, scanId])
  }, [updateIds])

  const releaseReview = useCallback((scanId: string) => {
    awaitingFormRef.current.delete(scanId)
  }, [])

  /**
   * Opens the editor on the scan the user actually asked about. Without naming the job, a second
   * finished receipt's toast would open whichever draft happened to be active. An open editor is
   * left alone: swapping the draft under it would discard the quantities already chosen there.
   */
  const reviewJob = useCallback((scanId: string) => {
    const result = completedRef.current.get(scanId)
    if (result && !isReceiptSplitOpenRef.current) setActiveDraft({ jobId: scanId, result })
    setActiveTab('ledger')
    setAutoOpenReceiptSplit(true)
  }, [isReceiptSplitOpenRef, setActiveDraft, setActiveTab, setAutoOpenReceiptSplit])

  const deleteOnce = useCallback((scanId: string) => {
    const existing = deletePromisesRef.current.get(scanId)
    if (existing) return existing
    const request = api.deleteReceiptScanJob(scanId)
      .catch(error => console.warn('Failed to delete receipt split scan job', error))
      .finally(() => deletePromisesRef.current.delete(scanId))
    deletePromisesRef.current.set(scanId, request)
    return request
  }, [])

  const forgetJob = useCallback((scanId: string) => {
    updateIds(current => current.filter(id => id !== scanId))
    notifiedRef.current.delete(scanId)
    completedRef.current.delete(scanId)
    awaitingFormRef.current.delete(scanId)
    if (activeDraftRef.current?.jobId === scanId) promoteNextDraft()
  }, [promoteNextDraft, updateIds])

  const clearJob = useCallback(async (scanId: string) => {
    forgetJob(scanId)
    setFailedJob(current => current?.jobId === scanId ? null : current)
    await deleteOnce(scanId)
  }, [deleteOnce, forgetJob])

  useEffect(() => {
    if (!token || jobIds.length === 0) return
    let cancelled = false

    const poll = async () => {
      if (pollInFlightRef.current) return
      pollInFlightRef.current = true
      try {
        for (const scanId of jobIds) {
          // A result already read back never needs fetching again, and re-reading it used to be
          // how two finished scans took turns as the active draft.
          if (cancelled || completedRef.current.has(scanId)) continue
          try {
            const job = await api.fetchReceiptSplitScanJob(scanId)
            if (cancelled || !jobIdsRef.current.includes(scanId)) continue
            if (job.status === 'failed') {
              const message = job.errorMessage || 'Receipt split scan failed. Please try again.'
              const awaitedByForm = awaitingFormRef.current.delete(scanId)
              setFailedJob({ jobId: scanId, errorMessage: message })
              updateIds(current => current.filter(id => id !== scanId))
              notifiedRef.current.delete(scanId)
              if (!awaitedByForm && !isReceiptSplitOpenRef.current)
                showToast(message, 'Receipt Split Failed', 'error')
              await deleteOnce(scanId)
              continue
            }
            if (job.status === 'completed' && job.result) {
              const result = job.result
              completedRef.current.set(scanId, result)
              const awaitedByForm = awaitingFormRef.current.delete(scanId)
              // A finished scan takes over the editor only when nothing else is waiting to be
              // reviewed, or when it is the one an open form is still spinning on. Anything else
              // waits its turn so an editor already in use keeps the receipt it is showing.
              if (awaitedByForm || !activeDraftRef.current) setActiveDraft({ jobId: scanId, result })
              if (!awaitedByForm && !isReceiptSplitOpenRef.current && !notifiedRef.current.has(scanId)) {
                notifiedRef.current.add(scanId)
                showToast('Receipt items were prepared for review.', 'Receipt Split Completed', 'success', {
                  label: 'Review',
                  onAction: () => reviewJob(scanId),
                })
              }
            }
          } catch (error: unknown) {
            if (errorMessageIncludes(error, '401') || errorMessageIncludes(error, '423')) continue
            if (errorMessageIncludesLower(error, 'not found')) forgetJob(scanId)
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
    isReceiptSplitOpenRef,
    showToast,
    updateIds,
    deleteOnce,
    forgetJob,
    reviewJob,
    setActiveDraft,
  ])

  return {
    activeReceiptSplitDraft: activeDraft,
    failedReceiptSplitJob: failedJob,
    receiptSplitJobIds: jobIds,
    handleReceiptSplitStarted: handleStarted,
    releaseReceiptSplitReview: releaseReview,
    clearReceiptSplitJob: clearJob,
  }
}
