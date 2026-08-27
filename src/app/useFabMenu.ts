import { useCallback, useEffect, useState } from 'react'
import type { AppTab } from '../types'

// Drafts already expose a dedicated Add draft action and a sticky batch action.
// Hiding the global quick-add here keeps those two page actions unobstructed.
export const shouldShowMobileFab = (activeTab: AppTab) => activeTab !== 'drafts'

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
