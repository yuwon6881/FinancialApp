import { useCallback, useEffect, useRef } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import type { ScanUploadKind } from '../lib/scanUploadStore'
import type { ToastTone } from '../components/ui/ToastViewport'

export interface PendingScanUploadHandlers {
  enabled: boolean
  ownerId: string
  onScanStarted: (kind: ScanUploadKind, scanId: string) => void
  showToast: (message: string, title?: string, tone?: ToastTone) => void
}

const DISCARDED_MESSAGES: Record<ScanUploadKind, string> = {
  receipt: 'A saved receipt photo could not be uploaded and has been dropped. Please scan it again.',
  'receipt-split': 'A saved receipt photo could not be uploaded and has been dropped. Please scan it again.',
  investment: 'A saved statement photo could not be uploaded and has been dropped. Please scan it again.',
}

/**
 * Finishes scan uploads the app never got to send.
 *
 * A scan is durable from the moment the server answers with a job id — the work is server-side and
 * the id is written to local storage — but the upload itself is a single request carrying several
 * megabytes, and a phone that sleeps or is swiped away during it used to lose the photo outright.
 * `scanUploadQueue` keeps those bytes; this hook is what comes back for them, on every signal that
 * the app is alive again: relaunch, tab restore, regained connectivity, and the native resume.
 *
 * A drained upload is handed to the same job tracking a fresh one uses, so it announces its result
 * through the ordinary completion toast rather than a second, parallel notification path.
 */
export function usePendingScanUploads({ enabled, ownerId, onScanStarted, showToast }: PendingScanUploadHandlers) {
  const drainingRef = useRef(false)
  const ownerRef = useRef(ownerId)
  const enabledRef = useRef(enabled)
  const drainRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const handlersRef = useRef({ onScanStarted, showToast })
  useEffect(() => {
    handlersRef.current = { onScanStarted, showToast }
  }, [onScanStarted, showToast])
  useEffect(() => {
    ownerRef.current = ownerId
    enabledRef.current = enabled
  }, [enabled, ownerId])

  const drain = useCallback(async () => {
    // One drain at a time: the wake-up signals below routinely arrive together (a relaunch fires
    // pageshow and visibilitychange), and a second pass would re-post an upload the first is
    // still waiting on.
    if (drainingRef.current) return
    drainingRef.current = true
    try {
      const { drainPendingScanUploads } = await import('../lib/api/scanUploadQueue')
      const result = await drainPendingScanUploads(ownerId)
      for (const started of result.started) {
        handlersRef.current.onScanStarted(started.kind, started.scanId)
      }
      for (const kind of result.discarded) {
        handlersRef.current.showToast(DISCARDED_MESSAGES[kind], 'Scan Upload Failed', 'error')
      }
    } catch (error) {
      // Deliberately quiet: the queue keeps whatever did not go through, and the next wake-up
      // tries again. Shouting about a retry the user did not ask for helps nobody.
      console.warn('Pending scan uploads could not be drained', error)
    } finally {
      drainingRef.current = false
      // If the account changed during a request, the old drain stops before the next file and
      // immediately hands ownership to the new account's filtered queue.
      if (enabledRef.current && ownerRef.current !== ownerId) void drainRef.current()
    }
  }, [ownerId])
  useEffect(() => {
    drainRef.current = drain
  }, [drain])

  useEffect(() => {
    if (!enabled) return
    const resume = () => { void drain() }
    const visible = () => {
      if (document.visibilityState === 'visible') resume()
    }
    resume()
    window.addEventListener('online', resume)
    window.addEventListener('pageshow', resume)
    document.addEventListener('visibilitychange', visible)
    let removeNative: (() => void) | undefined
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) resume()
    }).then(handle => {
      removeNative = () => { void handle.remove() }
    })
    return () => {
      window.removeEventListener('online', resume)
      window.removeEventListener('pageshow', resume)
      document.removeEventListener('visibilitychange', visible)
      removeNative?.()
    }
  }, [enabled, drain])
}
