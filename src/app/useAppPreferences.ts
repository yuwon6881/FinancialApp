import { useState, useEffect, useCallback } from 'react'
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
  billReminders: boolean
  setBillReminders: (value: boolean) => void
  ledgerCyclesRange: 'monthly' | '3month' | '6month' | 'yearly'
  setLedgerCyclesRange: (range: 'monthly' | '3month' | '6month' | 'yearly') => void
}

export function useAppPreferences(): AppPreferences {
  const [activeTab, setActiveTabState] = useState<AppTab>(() => {
    return readAppLocation().tab
  })

  const [hideSensitive, setHideSensitiveState] = useState<boolean>(() => {
    return localStorage.getItem('hide_sensitive') !== 'false'
  })

  const [hideBalanceAmounts, setHideBalanceAmountsState] = useState<boolean>(() => {
    return localStorage.getItem('hide_balance_amounts') === 'true'
  })

  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    // Respect an explicit saved choice; otherwise fall back to the OS/browser preference.
    const stored = localStorage.getItem('dark_mode')
    if (stored === 'true') return true
    if (stored === 'false') return false
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  })

  const [notifyOnLogin, setNotifyOnLoginState] = useState<boolean>(() => {
    return localStorage.getItem('show_notifications_on_login') !== 'false'
  })

  // Off by default: turning it on requests the OS notification permission (see the
  // Settings toggle), so it must be an explicit opt-in.
  const [billReminders, setBillRemindersState] = useState<boolean>(() => {
    return localStorage.getItem('bill_reminders_enabled') === 'true'
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

  const setHideSensitive = (value: boolean) => {
    setHideSensitiveState(value)
    localStorage.setItem('hide_sensitive', value.toString())
  }

  const setHideBalanceAmounts = (value: boolean) => {
    setHideBalanceAmountsState(value)
    localStorage.setItem('hide_balance_amounts', value.toString())
  }

  const setDarkMode = (value: boolean) => {
    setDarkModeState(value)
    localStorage.setItem('dark_mode', value.toString())
  }

  const setNotifyOnLogin = (value: boolean) => {
    setNotifyOnLoginState(value)
    localStorage.setItem('show_notifications_on_login', value.toString())
  }

  const setBillReminders = (value: boolean) => {
    setBillRemindersState(value)
    localStorage.setItem('bill_reminders_enabled', value.toString())
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
    billReminders,
    setBillReminders,
    ledgerCyclesRange,
    setLedgerCyclesRange,
  }
}
