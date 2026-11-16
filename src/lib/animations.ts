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
