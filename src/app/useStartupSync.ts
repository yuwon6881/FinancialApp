import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { getCachedDashboardPeriod } from '../lib/cache'

const debugLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args)
}

interface StartupSyncOptions {
  token: string | null
  isServerAwakeRef: RefObject<boolean>
  loadAll: (month?: string, year?: number, isBackground?: boolean) => Promise<void>
  processQueue: () => void
  setIsOffline: Dispatch<SetStateAction<boolean>>
}

export function useStartupSync({
  token,
  isServerAwakeRef,
  loadAll,
  processQueue,
  setIsOffline,
}: StartupSyncOptions) {
  const cancelledRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  const loadAllRef = useRef(loadAll)
  const processQueueRef = useRef(processQueue)

  useEffect(() => {
    loadAllRef.current = loadAll
    processQueueRef.current = processQueue
  }, [loadAll, processQueue])

  // Bootstrap is itself the best Cloud Run wake-up request. A separate ping only serialized
  // another round trip in front of warm launches, while failed bootstraps already identify the
  // cold/unavailable case that needs bounded retrying.
  const wakeUpAndSync = useCallback(async () => {
    if (!token || inFlightRef.current || !navigator.onLine) return
    cancelledRef.current = false
    let attempts = 0
    const runBootstrap = async () => {
      if (cancelledRef.current || !token || isServerAwakeRef.current) return
      inFlightRef.current = true
      const { month, year } = getCachedDashboardPeriod()
      try {
        await loadAllRef.current(month, year, attempts > 0)
      } finally {
        inFlightRef.current = false
      }
      if (cancelledRef.current) return
      if (isServerAwakeRef.current) {
        debugLog('Initial data load completed; processing the offline queue...')
        processQueueRef.current()
        return
      }
      attempts++
      if (attempts < 15) timeoutRef.current = setTimeout(runBootstrap, 5000)
    }
    void runBootstrap()
  }, [token, isServerAwakeRef])

  useEffect(() => {
    const online = () => setIsOffline(false)
    const offline = () => setIsOffline(true)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [setIsOffline])

  useEffect(() => {
    if (!token) {
      isServerAwakeRef.current = false
      return
    }
    void wakeUpAndSync()
    const online = () => {
      debugLog('Browser went online, retrying the initial data load...')
      void wakeUpAndSync()
    }
    window.addEventListener('online', online)
    return () => {
      window.removeEventListener('online', online)
      cancelledRef.current = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [token, isServerAwakeRef, wakeUpAndSync])

  return wakeUpAndSync
}
