import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import * as api from './api'
import type { InvestmentActivityScanResult } from './api'
import type { AppTab } from '../types'
import type { ToastTone } from '../components/ui/ToastViewport'
import { errorMessageIncludes, errorMessageIncludesLower } from './errors'

const JOB_IDS_KEY = 'investment_scan_job_ids'
const NOTIFIED_IDS_KEY = 'investment_scan_notified_ids'

const readIds = (key: string): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

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
  activeTabRef: MutableRefObject<AppTab>
  isInvestmentAddOpenRef: MutableRefObject<boolean>
  isMountedRef: MutableRefObject<boolean>
  setActiveTab: (tab: AppTab) => void
  setAutoOpenInvestmentAdd: (open: boolean) => void
  showToast: (message: string, title?: string, tone?: ToastTone) => void
}

export function useInvestmentScanPolling(options: Options) {
  const {
    token,
    activeTabRef,
    isInvestmentAddOpenRef,
    isMountedRef,
    setActiveTab,
    setAutoOpenInvestmentAdd,
    showToast,
  } = options
  const [jobIds, setJobIds] = useState<string[]>(() => readIds(JOB_IDS_KEY))
  const jobIdsRef = useRef(jobIds)
  const [notifiedIds, setNotifiedIds] = useState<string[]>(() => readIds(NOTIFIED_IDS_KEY))
  const [draft, setDraft] = useState<InvestmentScanDraft | null>(null)
  const [failure, setFailure] = useState<InvestmentScanFailure | null>(null)
  const pollInFlightRef = useRef(false)
  const deletePromisesRef = useRef<Map<string, Promise<void>>>(new Map())
  const deletedIdsRef = useRef<Set<string>>(new Set())

  const updateJobIds = useCallback((update: (current: string[]) => string[]) => {
    const next = update(jobIdsRef.current)
    jobIdsRef.current = next
    setJobIds(next)
    storeIds(JOB_IDS_KEY, next)
  }, [])

  useEffect(() => storeIds(NOTIFIED_IDS_KEY, notifiedIds), [notifiedIds])

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
    if (!token || jobIds.length === 0) return
    let cancelled = false

    const poll = async () => {
      if (pollInFlightRef.current) return
      pollInFlightRef.current = true
      try {
        for (const jobId of jobIds) {
          if (cancelled || draft?.jobId === jobId) continue
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
                  showToast('Your investment activity has been scanned successfully.', 'Investment Scan Complete', 'success')
                }
                window.setTimeout(() => {
                  if (!isMountedRef.current) return
                  setActiveTab('investments')
                  setAutoOpenInvestmentAdd(true)
                }, 1000)
              }
            }
          } catch (error: unknown) {
            if (errorMessageIncludes(error, '401') || errorMessageIncludes(error, '423')) continue
            if (errorMessageIncludesLower(error, 'not found'))
              updateJobIds(current => current.filter(id => id !== jobId))
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
  }, [token, jobIds, notifiedIds, draft, activeTabRef, isInvestmentAddOpenRef, isMountedRef,
    deleteOnce, setActiveTab, setAutoOpenInvestmentAdd, showToast, updateJobIds])

  return {
    activeInvestmentScanDraft: draft,
    failedInvestmentScanJob: failure,
    investmentScanJobIds: jobIds,
    handleInvestmentScanStarted: handleStarted,
    clearInvestmentScanJob: clear,
  }
}
