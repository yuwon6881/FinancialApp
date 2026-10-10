// Ref-counted body scroll lock.
//
// Several things can freeze background scrolling at once: a BottomSheet, a view
// that also locks while one of its modals is open, or one sheet opened from
// inside another. The naive "save body styles on lock, restore them on unlock"
// pattern breaks when two of these overlap: the second locker snapshots the
// *already-locked* body as its "previous" state, and whichever unlocks last
// writes that stale snapshot back — leaving `position: fixed` on <body> with
// nothing open, so the page can no longer scroll (an intermittent, order-
// dependent bug).
//
// Centralising here fixes that: the real body styles are captured only on the
// first lock and restored only when the last locker releases. Any number of
// overlapping callers is safe, and order no longer matters.
//
// It freezes the page with `overflow: hidden` on the root rather than the older `position: fixed`
// body with a negative `top`. Pinning the body set the window's scroll to 0 for as long as a sheet
// was open and put it back on close, and framer's layout animations (the section and tab pills,
// the chart legend rows) measure in page coordinates: a re-render that straddled the restore saw
// every animated element jump by the scroll offset and slid it back into place, so closing Ask AI
// or Bills to review halfway down a page replayed the animations under it. Hiding the overflow
// leaves the scroll position alone, so nothing moves. Every browser the app supports (Safari 16+
// included) honours it for touch scrolling as well.

interface SavedStyle {
  htmlOverflow: string
  bodyOverflow: string
  bodyPaddingRight: string
}

let lockCount = 0
let saved: SavedStyle | null = null

export function lockBodyScroll(): void {
  lockCount += 1
  // Only the first locker touches the DOM; later ones just bump the count.
  if (lockCount > 1) return

  const root = document.documentElement
  const { body } = document

  saved = {
    htmlOverflow: root.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
  }

  // From 768px the root reserves the scrollbar's lane (`scrollbar-gutter: stable`), so hiding the
  // scrollbar leaves the width unchanged. Padding the body as well narrowed the page by a scrollbar
  // on every open and widened it on every close, and each of those width changes replayed the
  // layout animations under the sheet (tab pills, chart legends sliding into place again).
  const gutterReserved = getComputedStyle(root).scrollbarGutter?.includes('stable') ?? false
  const scrollbarWidth = gutterReserved ? 0 : window.innerWidth - root.clientWidth

  root.style.overflow = 'hidden'
  body.style.overflow = 'hidden'
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`
  }
}

export function unlockBodyScroll(): void {
  if (lockCount === 0) return
  lockCount -= 1
  // Restore only once the last overlapping locker has released.
  if (lockCount > 0) return
  if (!saved) return

  document.documentElement.style.overflow = saved.htmlOverflow
  document.body.style.overflow = saved.bodyOverflow
  document.body.style.paddingRight = saved.bodyPaddingRight
  saved = null
}
