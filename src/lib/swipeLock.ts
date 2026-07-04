// Shared gesture lock so PullToRefresh can back off while a SwipeableRow is
// actively tracking a horizontal drag (the two independently listen for touch
// events, so without this a swipe with any vertical drift can also trigger a
// pull-to-refresh).
let locked = false

export const isSwipeLocked = () => locked
export const setSwipeLocked = (value: boolean) => {
  locked = value
}
