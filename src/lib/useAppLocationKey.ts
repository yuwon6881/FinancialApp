import { useEffect, useState } from 'react'
import { APP_LOCATION_CHANGED_EVENT } from './appLocation'

const currentKey = () => (typeof window === 'undefined' ? '' : `${window.location.pathname}${window.location.search}`)

/**
 * The current address, re-read whenever the app navigates. Navigating between two sections of the
 * same tab (Bills to Loans) changes the address without changing the active tab, so anything that
 * reflects the section has to follow the address rather than the tab.
 */
export function useAppLocationKey(): string {
  const [key, setKey] = useState(currentKey)
  useEffect(() => {
    const update = () => setKey(currentKey())
    window.addEventListener(APP_LOCATION_CHANGED_EVENT, update)
    window.addEventListener('popstate', update)
    return () => {
      window.removeEventListener(APP_LOCATION_CHANGED_EVENT, update)
      window.removeEventListener('popstate', update)
    }
  }, [])
  return key
}
