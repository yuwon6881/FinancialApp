import { useState, useEffect } from 'react'
import type { AppTab } from '../types'
import { APP_TABS } from '../types'

export interface AppPreferences {
  activeTab: AppTab
  setActiveTab: (tab: AppTab) => void
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
}

export function useAppPreferences(): AppPreferences {
  const [activeTab, setActiveTabState] = useState<AppTab>(() => {
    const cached = localStorage.getItem('active_tab')
    return APP_TABS.includes(cached as AppTab) ? (cached as AppTab) : 'dashboard'
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

  const [ledgerCyclesRange, setLedgerCyclesRange] = useState<'monthly' | '3month' | '6month' | 'yearly'>('monthly')

  useEffect(() => {
    localStorage.setItem('active_tab', activeTab)
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [activeTab])

  const setActiveTab = (tab: AppTab) => {
    setActiveTabState(tab)
  }

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
  }
}
