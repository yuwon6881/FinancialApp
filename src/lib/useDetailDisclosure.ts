import { useEffect, useState } from 'react'
import { useIsExpanded } from './breakpoints'

/**
 * Open/closed state for a card's detail tail, defaulting to open on desktop.
 *
 * Phones get one headline and one status line, with the rest a tap away; desktop has the room to
 * show everything at once. Re-seeding on every breakpoint change is the point — without it a tail
 * collapsed on a phone stays collapsed after a resize to a width whose summary row is hidden,
 * leaving the figures unreachable.
 *
 * Extracted from LoanCard, which had this state and effect inline.
 */
export function useDetailDisclosure(): {
  isOpen: boolean
  setOpen: (open: boolean) => void
  isMobile: boolean
} {
  const isMobile = !useIsExpanded()
  const [isOpen, setOpen] = useState(!isMobile)

  useEffect(() => {
    setOpen(!isMobile)
  }, [isMobile])

  return { isOpen, setOpen, isMobile }
}
