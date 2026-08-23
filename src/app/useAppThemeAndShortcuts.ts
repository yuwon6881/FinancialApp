import { useEffect } from 'react'
import { DARK_BG, LIGHT_BG, syncStatusBarTheme } from '../lib/nativeUi'
import { useVisualViewportVars } from '../lib/useVisualViewportVars'

export interface UseAppThemeAndShortcutsOptions {
  darkMode: boolean
  token: string | null
  isLocked: boolean
  showSearch: boolean
  setShowSearch: (open: boolean) => void
}

export function useAppThemeAndShortcuts(options: UseAppThemeAndShortcutsOptions) {
  const { darkMode, token, isLocked, showSearch, setShowSearch } = options

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    const surface = darkMode ? DARK_BG : LIGHT_BG
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', surface)
    document.documentElement.style.backgroundColor = surface
    document.body.style.backgroundColor = surface
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light'
    void syncStatusBarTheme(darkMode)
  }, [darkMode])

  useVisualViewportVars()

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      if (target.isContentEditable) return true
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    }
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      if (event.defaultPrevented || isTypingTarget(event.target)) return
      if (!token || isLocked || showSearch) return
      event.preventDefault()
      setShowSearch(true)
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [showSearch, setShowSearch, token, isLocked])
}
