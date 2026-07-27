import type { Variants, TargetAndTransition } from 'framer-motion'

// Variants for lists that still need Framer Motion — currently only the recurring-payment
// grid, whose cards animate on exit (listItemExit) and so must block unmount.
//
// The ledger rows and the wishlist queue previously shared these; their entrances are now
// CSS keyframes (.list-container-enter / .list-row-enter / .list-card-enter in index.css)
// because a one-shot opacity/transform entrance does not need a JS frame loop, and those
// were the highest-count animated nodes in the app. `rowFadeVariants` lived here for the
// ledger rows and went away with them.

// Shared stagger container for animated lists.
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
