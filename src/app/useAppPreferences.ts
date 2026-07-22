import { useState, useEffect, useCallback, useRef } from 'react'
import type { AppTab } from '../types'
import { navigateToAppTab, readAppLocation, type AppNavigationOptions } from '../lib/appLocation'

export interface AppPreferences {
  activeTab: AppTab
  setActiveTab: (tab: AppTab, options?: AppNavigationOptions) => void
  hideSensitive: boolean
  setHideSensitive: (value: boolean) => void
  hideBalanceAmounts: boolean
  setHideBalanceAmounts: (value: boolean) => void
  darkMode: boolean
  setDarkMode: (value: boolean) => void
  notifyOnLogin: boolean
  setNotifyOnLogin: (value: boolean) => void
  ledgerCyclesRange: 'monthly' | '3month' | '6month' | 'yearly'
  setLedgerCyclesRange: (range: 'monthly' | '3month' | '6month' | 'yearly') => void
  setPreferenceOwner: (username: string | null) => void
}

export function useAppPreferences(): AppPreferences {
  const preferenceOwnerRef = useRef<string | null>(null)
  const [activeTab, setActiveTabState] = useState<AppTab>(() => {
    return readAppLocation().tab
  })

  const [hideSensitive, setHideSensitiveState] = useState<boolean>(() => {
    return true
  })

  const [hideBalanceAmounts, setHideBalanceAmountsState] = useState<boolean>(() => {
    return false
  })

  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    // Respect an explicit saved choice; otherwise fall back to the OS/browser preference.
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  })

  const [notifyOnLogin, setNotifyOnLoginState] = useState<boolean>(() => {
    return true
  })

  const [ledgerCyclesRange, setLedgerCyclesRange] = useState<'monthly' | '3month' | '6month' | 'yearly'>('monthly')

  useEffect(() => {
    // Navigation is URL-based now (see appLocation.ts); the old `active_tab`
    // localStorage mirror is no longer read anywhere, so it isn't written.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [activeTab])

  useEffect(() => {
    if (window.location.pathname === '/' || window.location.search.includes('view=')) {
      navigateToAppTab(activeTab, { replace: true })
    }
    const handlePopState = () => setActiveTabState(readAppLocation().tab)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const setActiveTab = useCallback((tab: AppTab, options?: AppNavigationOptions) => {
    setActiveTabState(tab)
    navigateToAppTab(tab, options)
  }, [])

  const preferenceKey = (key: string) => {
    const owner = preferenceOwnerRef.current
    return owner ? `${key}:${owner}` : null
  }

  const readBooleanPreference = (key: string, fallback: boolean) => {
    const namespacedKey = preferenceKey(key)
    if (!namespacedKey) return fallback
    const stored = localStorage.getItem(namespacedKey)
    return stored === null ? fallback : stored === 'true'
  }

  const setPreferenceOwner = (username: string | null) => {
    preferenceOwnerRef.current = username
    // Sensitive mode is server-backed. Keep the safe state until the signed-in
    // account's dashboard settings have loaded instead of reusing browser state.
    setHideSensitiveState(true)
    setHideBalanceAmountsState(readBooleanPreference('hide_balance_amounts', false))
    setNotifyOnLoginState(readBooleanPreference('show_notifications_on_login', true))

    const storedDarkMode = preferenceKey('dark_mode')
    if (storedDarkMode && localStorage.getItem(storedDarkMode) === 'true') {
      setDarkModeState(true)
    } else if (storedDarkMode && localStorage.getItem(storedDarkMode) === 'false') {
      setDarkModeState(false)
    } else {
      setDarkModeState(typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false)
    }
  }

  const setHideSensitive = (value: boolean) => {
    setHideSensitiveState(value)
    const key = preferenceKey('hide_sensitive')
    if (key) localStorage.setItem(key, value.toString())
  }

  const setHideBalanceAmounts = (value: boolean) => {
    setHideBalanceAmountsState(value)
    const key = preferenceKey('hide_balance_amounts')
    if (key) localStorage.setItem(key, value.toString())
  }

  const setDarkMode = (value: boolean) => {
    setDarkModeState(value)
    const key = preferenceKey('dark_mode')
    if (key) localStorage.setItem(key, value.toString())
  }

  const setNotifyOnLogin = (value: boolean) => {
    setNotifyOnLoginState(value)
    const key = preferenceKey('show_notifications_on_login')
    if (key) localStorage.setItem(key, value.toString())
  }

  return {
    activeTab,
    setActiveTab,
    hideSensitive,
    setHideSensitive,
    hideBalanceAmounts,
    setHideBalanceAmounts,
    darkMode,
    setDarkMode,
    notifyOnLogin,
    setNotifyOnLogin,
    ledgerCyclesRange,
    setLedgerCyclesRange,
    setPreferenceOwner,
  }
}
