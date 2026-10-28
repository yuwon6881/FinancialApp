import { prefersReducedMotion } from './motionPreference'

/** Slightly longer than BottomSheet's exit animation (0.24s), so a page change that follows a closing sheet lands after the sheet has left. */
export const SHEET_EXIT_MS = 280

/**
 * Defers a tab change until the BottomSheet exit animation has completed,
 * or fires on the next tick (0 ms timer) when reduced motion is preferred.
 */
export function deferTabChange<T>(setActiveTab: (tab: T) => void, tab: T): number {
  const delay = prefersReducedMotion() ? 0 : SHEET_EXIT_MS
  return window.setTimeout(() => setActiveTab(tab), delay)
}
