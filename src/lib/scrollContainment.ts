/**
 * Revealing an element inside its own scroll box, without moving the page.
 *
 * `Element.scrollIntoView` walks every scrollable ancestor up to the document, so using it for a
 * hover-driven reveal can scroll the whole page out from under the pointer. These helpers stop at
 * the nearest ancestor that actually scrolls, and do nothing at all when there is none — a clipped
 * (`overflow: hidden`) list has no scroll position to move, and forcing one strands its content.
 */

/** Vertical edges of a box, in the same coordinate space for both arguments. */
export interface VerticalBounds {
  top: number
  bottom: number
}

/**
 * How far to scroll a container so `target` is fully inside it, or 0 when it already is.
 *
 * The margin applies only once the target is genuinely clipped: adding it unconditionally would
 * nudge the list every time the pointer landed on an item resting flush against an edge.
 */
export function scrollOffsetToReveal(
  container: VerticalBounds,
  target: VerticalBounds,
  margin = 8,
): number {
  if (target.top < container.top) return target.top - container.top - margin
  if (target.bottom > container.bottom) return target.bottom - container.bottom + margin
  return 0
}

const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll', 'overlay'])

/**
 * The nearest ancestor that can scroll vertically, or null.
 *
 * `document.body`/`documentElement` are deliberately excluded: reaching them means the element is
 * merely below the fold of the page, and scrolling the page in response to a hover is jarring
 * rather than helpful.
 */
export function findScrollableAncestor(element: HTMLElement): HTMLElement | null {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return null
  let parent = element.parentElement
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const { overflowY } = window.getComputedStyle(parent)
    if (SCROLLABLE_OVERFLOW.has(overflowY) && parent.scrollHeight > parent.clientHeight + 1) {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

/**
 * Scrolls `element` into view within its own scroll box. A no-op when nothing scrolls, when the
 * element is already visible, or in an environment without layout (jsdom reports every box as
 * zero-sized, so the offset is always 0 there).
 */
export function revealWithinScrollParent(element: HTMLElement, behavior: ScrollBehavior): void {
  const container = findScrollableAncestor(element)
  if (!container || typeof container.scrollBy !== 'function') return
  const offset = scrollOffsetToReveal(
    container.getBoundingClientRect(),
    element.getBoundingClientRect(),
  )
  if (offset === 0) return
  container.scrollBy({ top: offset, behavior })
}
