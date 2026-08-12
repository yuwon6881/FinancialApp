import { useCallback, useEffect, useState } from 'react'
import type { AppTab } from '../types'

const MOBILE_FAB_HIDDEN_TABS: ReadonlySet<AppTab> = new Set(['drafts', 'wishlist', 'recurring', 'documents'])

export const shouldShowMobileFab = (activeTab: AppTab) => !MOBILE_FAB_HIDDEN_TABS.has(activeTab)

export function useFabMenu(activeTab: AppTab) {
  const [isOpen, setIsOpen] = useState(false)

  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(value => !value), [])

  useEffect(() => {
    close()
  }, [activeTab, close])

  useEffect(() => {
    if (!isOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [close, isOpen])

  return { close, isOpen, toggle }
}
