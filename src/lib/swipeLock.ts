// Shared gesture lock so PullToRefresh can back off while a SwipeableRow is
// actively tracking a horizontal drag (the two independently listen for touch
// events, so without this a swipe with any vertical drift can also trigger a
// pull-to-refresh).
let locked = false
let closeActiveRow: (() => void) | null = null

export const isSwipeLocked = () => locked
export const setSwipeLocked = (value: boolean) => {
  locked = value
}

/** Register the one open row so global gestures can close it before they move the page. */
export const registerSwipeRowCloser = (close: () => void) => {
  closeActiveRow = close
}

export const clearSwipeRowCloser = (close: () => void) => {
  if (closeActiveRow === close) closeActiveRow = null
}

export const closeOpenSwipeableRow = () => {
  closeActiveRow?.()
}
