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

// ── Lumen motion ────────────────────────────────────────────────────────────────
// One easing family and three springs. CSS uses the same curve as `--ease-fluid` and the same
// durations as `--duration-*` in index.css, so a framer animation and a CSS transition that run
// side by side never feel like two different products. Every consumer stays behind
// `MotionConfig reducedMotion="user"`, which zeroes transforms for people who ask for less motion.

/** Ease-out with a long, soft tail. The default for anything that enters or settles. */
export const EASE_FLUID: [number, number, number, number] = [0.22, 1, 0.36, 1]

export const DURATION = {
  press: 0.12,
  quick: 0.18,
  enter: 0.24,
  large: 0.32,
} as const

export const SPRING = {
  /** Selection pills, toggles, small layout shifts: fast, no visible overshoot. */
  snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 0.9 },
  /** Cards and panels moving into place. */
  smooth: { type: 'spring', stiffness: 300, damping: 32 },
  /** Bottom sheets and drawers: travels far, must never bounce past its rest point. */
  sheet: { type: 'spring', stiffness: 400, damping: 40, bounce: 0 },
} as const
