import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import * as api from './api'
import type { InvestmentActivityScanResult } from './api'
import type { AppTab } from '../types'
import type { ToastAction, ToastTone } from '../components/ui/ToastViewport'
import { errorMessageIncludes, errorMessageIncludesLower } from './errors'
import { scanReviewAction } from './scanReviewAction'
import { readStoredScanJobIds, scanJobIdsStorageKey } from './scanJobIds'

const storeIds = (key: string, ids: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch (error) {
    console.warn(`Failed to persist ${key}`, error)
  }
}

export interface InvestmentScanDraft {
  jobId: string
  result: InvestmentActivityScanResult
}

export interface InvestmentScanFailure {
  jobId: string
  errorMessage: string
}

interface Options {
  token: string | null
  /** Signed-in username; tracked scan ids are stored per account. */
  account: string
  activeTabRef: MutableRefObject<AppTab>
  isInvestmentAddOpenRef: MutableRefObject<boolean>
  setActiveTab: (tab: AppTab) => void
  setAutoOpenInvestmentAdd: (open: boolean) => void
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
}

export function useInvestmentScanPolling(options: Options) {
  const {
    token,
    account,
    activeTabRef,
    isInvestmentAddOpenRef,
    setActiveTab,
    setAutoOpenInvestmentAdd,
    showToast,
  } = options
  const storageKey = scanJobIdsStorageKey('investment_scan_job_ids', account)
  const [jobIds, setJobIds] = useState<string[]>(() => readStoredScanJobIds('investment_scan_job_ids', account))
  const jobIdsRef = useRef(jobIds)
  /**
   * One-shot record of the completion toasts already raised. Two finished scans take turns being
   * the active draft, so without it the same toast fires on every poll tick. It is deliberately
   * per-session: the toast is the only route back to an unconsumed result on a fresh start, so a
   * record that outlived the session left a finished scan stranded until retention deleted it.
   */
  const [notifiedIds, setNotifiedIds] = useState<string[]>([])
  const [draft, setDraft] = useState<InvestmentScanDraft | null>(null)
  const [failure, setFailure] = useState<InvestmentScanFailure | null>(null)
  const pollInFlightRef = useRef(false)
  const deletePromisesRef = useRef<Map<string, Promise<void>>>(new Map())
  const deletedIdsRef = useRef<Set<string>>(new Set())

  const updateJobIds = useCallback((update: (current: string[]) => string[]) => {
    const next = update(jobIdsRef.current)
    jobIdsRef.current = next
    setJobIds(next)
    storeIds(storageKey, next)
  }, [storageKey])

  const deleteOnce = useCallback((jobId: string): Promise<void> => {
    if (deletedIdsRef.current.has(jobId)) return Promise.resolve()
    const inFlight = deletePromisesRef.current.get(jobId)
    if (inFlight) return inFlight
    const request = api.deleteReceiptScanJob(jobId)
      .then(() => { deletedIdsRef.current.add(jobId) })
      .catch(error => { console.warn('Failed to delete investment scan job', error) })
      .finally(() => { deletePromisesRef.current.delete(jobId) })
    deletePromisesRef.current.set(jobId, request)
    return request
  }, [])

  const clear = useCallback(async (jobId: string) => {
    updateJobIds(current => current.filter(id => id !== jobId))
    setNotifiedIds(current => current.filter(id => id !== jobId))
    setDraft(current => current?.jobId === jobId ? null : current)
    setFailure(current => current?.jobId === jobId ? null : current)
    await deleteOnce(jobId)
  }, [deleteOnce, updateJobIds])

  const handleStarted = useCallback((jobId: string) => {
    deletedIdsRef.current.delete(jobId)
    setFailure(null)
    updateJobIds(current => current.includes(jobId) ? current : [...current, jobId])
  }, [updateJobIds])

  useEffect(() => {
    if (!token || jobIds.length === 0 || draft) return
    let cancelled = false

    const poll = async () => {
      if (pollInFlightRef.current) return
      pollInFlightRef.current = true
      try {
        for (const jobId of jobIds) {
          if (cancelled) break
          try {
            const job = await api.fetchInvestmentScanJob(jobId)
            if (cancelled || !jobIdsRef.current.includes(jobId)) continue
            if (job.status === 'failed') {
              const message = job.errorMessage || 'Investment scan failed. Please try again.'
              setFailure({ jobId, errorMessage: message })
              if (!(activeTabRef.current === 'investments' && isInvestmentAddOpenRef.current))
                showToast(message, 'Investment Scan Failed', 'error')
              updateJobIds(current => current.filter(id => id !== jobId))
              setNotifiedIds(current => current.filter(id => id !== jobId))
              void deleteOnce(jobId)
              continue
            }
            if (job.status === 'completed' && job.result) {
              setDraft({ jobId, result: job.result })
              const isInModal = activeTabRef.current === 'investments' && isInvestmentAddOpenRef.current
              if (!isInModal) {
                if (!notifiedIds.includes(jobId)) {
                  setNotifiedIds(current => current.includes(jobId) ? current : [...current, jobId])
                  showToast('Investment record was scanned successfully.', 'Investment Scan Completed', 'success', scanReviewAction(setActiveTab, setAutoOpenInvestmentAdd, 'investments'))
                }
              }
              break
            }
          } catch (error: unknown) {
            if (errorMessageIncludes(error, '401') || errorMessageIncludes(error, '423')) continue
            if (errorMessageIncludesLower(error, 'not found')) {
              updateJobIds(current => current.filter(id => id !== jobId))
              setNotifiedIds(current => current.filter(id => id !== jobId))
              setDraft(current => current?.jobId === jobId ? null : current)
              setFailure(current => current?.jobId === jobId ? null : current)
            }
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
  }, [token, jobIds, notifiedIds, draft, activeTabRef, isInvestmentAddOpenRef,
    deleteOnce, setActiveTab, setAutoOpenInvestmentAdd, showToast, updateJobIds])

  return {
    activeInvestmentScanDraft: draft,
    failedInvestmentScanJob: failure,
    investmentScanJobIds: jobIds,
    handleInvestmentScanStarted: handleStarted,
    clearInvestmentScanJob: clear,
  }
}
