import { useEffect, useRef, useState } from 'react'
import { updateAppSearch } from '../lib/appLocation'

export type PwaShortcutAction = 'add-transaction' | 'scan-receipt' | 'upcoming-bills'

const ACTION_QUERY_KEY = 'pwaAction'

const isShortcutAction = (value: string | null): value is PwaShortcutAction =>
  value === 'add-transaction' || value === 'scan-receipt' || value === 'upcoming-bills'

/** Launcher intent remains in the URL through the login and installed-app launch gates. */
export function getPwaShortcutAction(search: string): PwaShortcutAction | null {
  const action = new URLSearchParams(search).get(ACTION_QUERY_KEY)
  return isShortcutAction(action) ? action : null
}

interface UsePwaShortcutActionOptions {
  actionReady: boolean
  username: string
  hideSensitive: boolean
  sensitivePreferenceStatus: 'pending' | 'resolved' | 'unavailable'
  onRequestSensitiveReveal: () => void
  onRunAction: (action: PwaShortcutAction) => void
  onClearAction: () => void
}

/** Hold launcher actions through login and the installed-PWA launch gate. */
export function usePwaShortcutAction({
  actionReady,
  username,
  hideSensitive,
  sensitivePreferenceStatus,
  onRequestSensitiveReveal,
  onRunAction,
  onClearAction,
}: UsePwaShortcutActionOptions): void {
  const [pendingAction, setPendingAction] = useState<PwaShortcutAction | null>(() =>
    typeof window === 'undefined' ? null : getPwaShortcutAction(window.location.search))
  const lastAuthenticatedUsernameRef = useRef(actionReady && username ? username : '')
  const promptRequestedRef = useRef(false)
  const accountChangedRef = useRef(false)

  useEffect(() => {
    const previousUsername = lastAuthenticatedUsernameRef.current
    if (actionReady && username) {
      if (previousUsername && previousUsername !== username) {
        accountChangedRef.current = true
        setPendingAction(null)
        onClearAction()
        updateAppSearch({ [ACTION_QUERY_KEY]: null })
      }
      lastAuthenticatedUsernameRef.current = username
    } else if (!username && previousUsername) {
      accountChangedRef.current = true
      setPendingAction(null)
      lastAuthenticatedUsernameRef.current = ''
      onClearAction()
      updateAppSearch({ [ACTION_QUERY_KEY]: null })
    }
  }, [actionReady, onClearAction, username])

  useEffect(() => {
    if (!pendingAction || !actionReady || accountChangedRef.current) return
    const needsReveal = pendingAction !== 'upcoming-bills'
    if (needsReveal && sensitivePreferenceStatus !== 'resolved') return
    if (needsReveal && hideSensitive) {
      if (!promptRequestedRef.current) {
        promptRequestedRef.current = true
        onRequestSensitiveReveal()
      }
      return
    }

    onRunAction(pendingAction)
    setPendingAction(null)
    promptRequestedRef.current = false
    updateAppSearch({ [ACTION_QUERY_KEY]: null })
  }, [
    actionReady,
    hideSensitive,
    onRequestSensitiveReveal,
    onRunAction,
    pendingAction,
    sensitivePreferenceStatus,
  ])
}
