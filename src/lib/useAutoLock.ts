import { useEffect, useRef } from 'react'
import * as api from './api'
import { prefetchFingerprintAssertOptions } from './fingerprintOptionsCache'

const LOCK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const UNLOCK_CHALLENGE_PREFETCH_WINDOW_MS = 30 * 1000

export interface UseAutoLockOptions {
  token: string | null
  isLocked: boolean
  hasFingerprintSetup: boolean
  /** Perform the local lock transition (also triggered by the server-lock event). */
  markSessionLocked: () => void
  /** Called when the lock request itself 401s — the session is gone, so log out. */
  onAuthError: () => void
}

/**
 * Inactivity auto-lock. Owns three concerns lifted verbatim from App.tsx:
 *  - listen for the server-driven SESSION_LOCKED event and lock locally;
 *  - track user activity (throttled `last_active_time` + session heartbeat);
 *  - poll every 15s and lock once idle beyond LOCK_TIMEOUT_MS, prefetching the
 *    fingerprint unlock challenge shortly before the lock fires.
 *
 * The cross-cutting lock state/transition (`isLocked`, `markSessionLocked`) is
 * owned by App and injected, since login/sync/heartbeat also touch it.
 */
export function useAutoLock(options: UseAutoLockOptions): void {
  const { token, isLocked, hasFingerprintSetup, markSessionLocked, onAuthError } = options
  const unlockChallengePrefetchedForIdleRef = useRef(false)
  const lockRequestInFlightRef = useRef(false)

  useEffect(() => {
    if (!token) return

    const handleSessionLocked = () => markSessionLocked()
    window.addEventListener(api.SESSION_LOCKED_EVENT, handleSessionLocked)
    return () => window.removeEventListener(api.SESSION_LOCKED_EVENT, handleSessionLocked)
  }, [token, markSessionLocked])

  // Inactivity tracking - update last_active_time in localStorage
  useEffect(() => {
    if (!token || isLocked) return
    // A fresh document is active by definition. Do not count time while the site was closed as
    // inactivity: the installed-mobile-PWA launch gate protects that separate startup boundary,
    // while an actual session lock is restored through the local flags or a server 423.
    localStorage.setItem('last_active_time', Date.now().toString())
    void api.sendSessionHeartbeat()
    const updateActivity = () => {
      localStorage.setItem('last_active_time', Date.now().toString())
    }
    // Throttle to once per 5 seconds
    let lastUpdate = 0
    // Longer, separate throttle for the network heartbeat (this is what makes "Active Devices"
    // in Settings show real last-used time instead of just session creation time) -- no need to
    // hit the server anywhere near as often as we update the local inactivity-lock timestamp.
    let lastHeartbeat = 0
    const throttled = () => {
      const now = Date.now()
      if (now - lastUpdate > 5000) {
        lastUpdate = now
        unlockChallengePrefetchedForIdleRef.current = false
        updateActivity()
      }
      if (now - lastHeartbeat > 60000) {
        lastHeartbeat = now
        void api.sendSessionHeartbeat()
      }
    }
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, throttled, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, throttled))
  }, [token, isLocked])

  // Check inactivity every 15 seconds and lock if exceeded
  useEffect(() => {
    if (!token || isLocked) return
    const checkInactivity = () => {
      const lastActive = Number(localStorage.getItem('last_active_time') || Date.now())
      const idleFor = Date.now() - lastActive
      if (
        hasFingerprintSetup &&
        !unlockChallengePrefetchedForIdleRef.current &&
        idleFor > LOCK_TIMEOUT_MS - UNLOCK_CHALLENGE_PREFETCH_WINDOW_MS
      ) {
        unlockChallengePrefetchedForIdleRef.current = true
        void prefetchFingerprintAssertOptions().catch(() => undefined)
      }
      if (idleFor > LOCK_TIMEOUT_MS && !lockRequestInFlightRef.current) {
        lockRequestInFlightRef.current = true
        markSessionLocked()
        if (hasFingerprintSetup) {
          void prefetchFingerprintAssertOptions().catch(() => undefined)
        }
        void api.lockSession()
          .catch(err => {
            if (err?.message && (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'))) {
              onAuthError()
            } else {
              console.warn('Failed to lock session on server; the local inactivity lock remains active:', err)
            }
          })
          .finally(() => {
            lockRequestInFlightRef.current = false
          })
      }
    }
    checkInactivity()
    const interval = setInterval(checkInactivity, 15000)
    return () => clearInterval(interval)
  }, [token, isLocked, markSessionLocked, hasFingerprintSetup, onAuthError])
}
