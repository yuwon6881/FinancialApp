import { useCallback, useEffect, useState } from 'react'
import type { AppTab } from '../types'

export const shouldShowMobileFab = (_activeTab: AppTab) => true

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
