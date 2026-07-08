import type { Variants, TargetAndTransition } from 'framer-motion'

// Shared stagger container for animated lists (Ledger, Wishlist, RecurringPayments, Dashboard).
export const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

// Shared per-item entrance for card-style list items.
export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120 } },
}

// Shared exit for card-style list items removed from an AnimatePresence list.
export const listItemExit: TargetAndTransition = {
  opacity: 0,
  scale: 0.95,
  transition: { duration: 0.15 },
}

// Plain fade for Ledger's transaction rows -- deliberately opacity-only, no `y`
// offset and no `layout` prop on the callers, so pagination/cycle switches
// (which remount the whole row set) never trigger a position-FLIP cascade
// across sibling rows. See listItemVariants above for the card-grid equivalent.
export const rowFadeVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18, ease: 'easeOut' } },
}
