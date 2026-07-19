import { useState, useEffect, useRef, useCallback } from 'react'
import * as api from '../lib/api'
import { tokenStore, resolveSessionToken, usesCookieAuth, WEB_COOKIE_SESSION } from '../lib/auth'
import { isPlatformAuthenticatorAvailable, getFingerprintAssertion } from '../lib/webauthn'
import {
  clearCachedFingerprintAssertOptions,
  getCachedFingerprintAssertOptions,
  prefetchFingerprintAssertOptions,
} from '../lib/fingerprintOptionsCache'
import { useAutoLock } from '../lib/useAutoLock'

export interface UseAppSessionOptions {
  onLogoutBackupAndCleanup: (username: string) => void | Promise<void>
  onLoginSuccessRestore: (username: string) => void
  loadAll: (month?: string, year?: number, isBackground?: boolean) => void
  setHideSensitive: (value: boolean) => void
  hideSensitive: boolean
  loadAllAbortRef: React.MutableRefObject<AbortController | null>
}

export interface AppSession {
  token: string | null
  setToken: (token: string | null) => void
  username: string
  setUsername: (username: string) => void
  isLocked: boolean
  setIsLocked: (value: boolean) => void
  hasFingerprintSetup: boolean
  setHasFingerprintSetup: (value: boolean) => void
  showPasswordPrompt: boolean
  setShowPasswordPrompt: (value: boolean) => void
  markSessionLocked: () => void
  handleUnlocked: () => void
  handleLogout: () => Promise<void>
  handleLoginSuccess: (newToken: string, newUsername: string) => void
  revealSensitiveWithFingerprint: () => Promise<boolean>
  lastUnlockedTimeRef: React.MutableRefObject<number>
  usernameRef: React.MutableRefObject<string>
}

export function useAppSession(options: UseAppSessionOptions): AppSession {
  const { onLogoutBackupAndCleanup, onLoginSuccessRestore, loadAll, setHideSensitive, hideSensitive, loadAllAbortRef } = options

  const [token, setToken] = useState<string | null>(null)
  const [username, setUsername] = useState<string>(localStorage.getItem('auth_username') || '')

  const lastUnlockedTimeRef = useRef<number>(0)
  const usernameRef = useRef(username)

  useEffect(() => {
    usernameRef.current = username
  }, [username])

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    // Native secure storage cannot be read synchronously, so the initializer only
    // trusts the per-tab flag. The token-dependent global-lock case is reconciled
    // in the bootstrap effect below once the stored token has been read.
    return sessionStorage.getItem('session_locked') === 'true'
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const sessionToken = await resolveSessionToken()
      if (cancelled) return
      setToken(sessionToken)
      // Reconcile the global lock only when this tab has no explicit lock state yet.
      if (
        sessionToken
        && sessionStorage.getItem('session_locked') === null
        && localStorage.getItem('session_locked_global') === 'true'
      ) {
        setIsLocked(true)
        sessionStorage.setItem('session_locked', 'true')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const markSessionLocked = useCallback(() => {
    loadAllAbortRef.current?.abort()
    api.invalidateCache()
    setIsLocked(true)
    sessionStorage.setItem('session_locked', 'true')
    localStorage.setItem('session_locked_global', 'true')
  }, [loadAllAbortRef])

  const handleUnlocked = useCallback(() => {
    lastUnlockedTimeRef.current = Date.now()
    localStorage.setItem('last_active_time', Date.now().toString())
    sessionStorage.setItem('session_locked', 'false')
    localStorage.setItem('session_locked_global', 'false')
    setIsLocked(false)
    loadAll(undefined, undefined, true)
  }, [loadAll])

  // Propagate a lock across open tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'session_locked_global' && e.newValue === 'true'
        && sessionStorage.getItem('session_locked') !== 'true') {
        markSessionLocked()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [markSessionLocked])

  const [showPasswordPrompt, setShowPasswordPrompt] = useState<boolean>(false)
  const [hasFingerprintSetup, setHasFingerprintSetup] = useState<boolean>(false)

  useEffect(() => {
    if (!token) {
      setHasFingerprintSetup(false)
      clearCachedFingerprintAssertOptions()
      return
    }

    let cancelled = false
    ;(async () => {
      const platformAvailable = await isPlatformAuthenticatorAvailable().catch(() => false)
      if (cancelled) return

      if (!platformAvailable) {
        setHasFingerprintSetup(false)
        clearCachedFingerprintAssertOptions()
        return
      }

      const status = await api.fetchAuthStatus(username).catch(() => null)
      if (cancelled) return

      const hasFingerprint = !!status?.hasFingerprint
      setHasFingerprintSetup(hasFingerprint)
      if (!hasFingerprint) {
        clearCachedFingerprintAssertOptions()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, username])

  useEffect(() => {
    if (!token || isLocked || !hideSensitive || !hasFingerprintSetup) return
    void prefetchFingerprintAssertOptions().catch(() => undefined)
  }, [token, isLocked, hideSensitive, hasFingerprintSetup])

  async function handleLogout() {
    const currentOwner = usernameRef.current
    try {
      await onLogoutBackupAndCleanup(currentOwner)
    } catch (error) {
      console.error('Logout backup and cleanup failed; continuing sign-out.', error)
    }

    try {
      await api.logout()
    } catch (error) {
      console.error('Logout request failed; clearing the local session anyway.', error)
    }

    // api.logout() normally clears the token store itself. Keep this fallback
    // here so a platform-specific or mocked implementation cannot leave a
    // usable local credential behind.
    try {
      await tokenStore.clearToken()
    } catch (error) {
      console.error('Could not clear the platform token store during logout.', error)
    }

    for (const [storage, key] of [
      [localStorage, 'auth_username'],
      [localStorage, 'session_locked_global'],
      [localStorage, 'last_active_time'],
      [sessionStorage, 'session_locked'],
    ] as const) {
      try {
        storage.removeItem(key)
      } catch (error) {
        console.warn(`Could not remove ${key} during logout.`, error)
      }
    }
    setToken(null)
    setUsername('')
    setHasFingerprintSetup(false)
    clearCachedFingerprintAssertOptions()
    setIsLocked(false)
  }

  useAutoLock({ token, isLocked, hasFingerprintSetup, markSessionLocked, onAuthError: handleLogout })

  const handleLoginSuccess = async (newToken: string, newUsername: string) => {
    await tokenStore.setToken(newToken)
    localStorage.setItem('auth_username', newUsername)
    sessionStorage.setItem('session_locked', 'false')
    localStorage.setItem('session_locked_global', 'false')
    const now = Date.now()
    localStorage.setItem('last_active_time', now.toString())
    lastUnlockedTimeRef.current = now
    setIsLocked(false)
    api.invalidateCache()
    // On the web the real bearer token is never held in memory — the cookie is the credential and
    // this opaque marker only gates the logged-in UI. Native keeps the real token for its header.
    setToken(usesCookieAuth ? WEB_COOKIE_SESSION : newToken)
    setUsername(newUsername)

    onLoginSuccessRestore(newUsername)
  }

  const revealSensitiveWithFingerprint = async (): Promise<boolean> => {
    if (!hasFingerprintSetup) return false
    let verified = false
    try {
      const { challengeId, options: fingerprintOptions } = await getCachedFingerprintAssertOptions()
      const credential = await getFingerprintAssertion(fingerprintOptions)
      await api.verifyFingerprintAssert(challengeId, credential)
      setHideSensitive(false)
      localStorage.setItem('hide_sensitive', 'false')
      verified = true
      return true
    } catch (err) {
      console.warn('Fingerprint prompt failed/cancelled:', err)
      return false
    } finally {
      clearCachedFingerprintAssertOptions()
      if (!verified && token && !isLocked && hideSensitive) {
        void prefetchFingerprintAssertOptions().catch(() => undefined)
      }
    }
  }

  return {
    token,
    setToken,
    username,
    setUsername,
    isLocked,
    setIsLocked,
    hasFingerprintSetup,
    setHasFingerprintSetup,
    showPasswordPrompt,
    setShowPasswordPrompt,
    markSessionLocked,
    handleUnlocked,
    handleLogout,
    handleLoginSuccess,
    revealSensitiveWithFingerprint,
    lastUnlockedTimeRef,
    usernameRef,
  }
}
