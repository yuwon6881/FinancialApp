import { useCallback, useEffect, useState } from 'react'
import type { AppTab } from '../types'

// Open state for the quick-add sheet behind the tab bar's add button. It closes itself whenever the
// destination changes, since every action in it navigates somewhere.
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
