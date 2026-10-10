import { afterEach, describe, expect, it } from 'vitest'
import { lockBodyScroll, unlockBodyScroll } from './scrollLock'

describe('scrollLock', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style')
    document.body.removeAttribute('style')
  })

  it('hides the overflow without pinning the body, so the scroll position never moves', () => {
    lockBodyScroll()
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.position).toBe('')
    expect(document.body.style.top).toBe('')
    unlockBodyScroll()
    expect(document.documentElement.style.overflow).toBe('')
    expect(document.body.style.overflow).toBe('')
  })

  it('keeps the page locked until the last overlapping locker releases, then restores the original styles', () => {
    document.body.style.overflow = 'clip'
    lockBodyScroll()
    lockBodyScroll()
    unlockBodyScroll()
    expect(document.documentElement.style.overflow).toBe('hidden')
    unlockBodyScroll()
    expect(document.documentElement.style.overflow).toBe('')
    expect(document.body.style.overflow).toBe('clip')
    // An unmatched release is a no-op rather than a negative count.
    unlockBodyScroll()
    lockBodyScroll()
    expect(document.body.style.overflow).toBe('hidden')
    unlockBodyScroll()
  })
})
