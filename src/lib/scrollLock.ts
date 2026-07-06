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

interface SavedBodyStyle {
  position: string
  top: string
  left: string
  right: string
  width: string
  overflow: string
  paddingRight: string
  scrollY: number
}

let lockCount = 0
let saved: SavedBodyStyle | null = null

export function lockBodyScroll(): void {
  lockCount += 1
  // Only the first locker touches the DOM; later ones just bump the count.
  if (lockCount > 1) return

  const { body } = document
  const scrollY = window.scrollY

  saved = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
    scrollY,
  }

  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

  body.style.position = 'fixed'
  body.style.top = `-${scrollY}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
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

  const { body } = document
  const { scrollY } = saved

  body.style.position = saved.position
  body.style.top = saved.top
  body.style.left = saved.left
  body.style.right = saved.right
  body.style.width = saved.width
  body.style.overflow = saved.overflow
  body.style.paddingRight = saved.paddingRight
  saved = null

  window.scrollTo(0, scrollY)
}
