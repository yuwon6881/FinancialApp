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
