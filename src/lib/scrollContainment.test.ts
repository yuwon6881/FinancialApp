import { describe, expect, it } from 'vitest'
import { scrollOffsetToReveal } from './scrollContainment'

describe('scrollOffsetToReveal', () => {
  const container = { top: 100, bottom: 260 }

  it('leaves a fully visible target alone', () => {
    expect(scrollOffsetToReveal(container, { top: 120, bottom: 148 })).toBe(0)
  })

  // The margin is why this matters: applied unconditionally it would nudge the list every time the
  // pointer reached an item resting against an edge, so a flush-but-visible row must return 0.
  it('does not move a target resting flush against either edge', () => {
    expect(scrollOffsetToReveal(container, { top: 100, bottom: 128 })).toBe(0)
    expect(scrollOffsetToReveal(container, { top: 232, bottom: 260 })).toBe(0)
  })

  it('scrolls up by the overshoot plus a margin when the target is clipped above', () => {
    expect(scrollOffsetToReveal(container, { top: 70, bottom: 98 }, 8)).toBe(-38)
  })

  it('scrolls down by the overshoot plus a margin when the target is clipped below', () => {
    expect(scrollOffsetToReveal(container, { top: 300, bottom: 328 }, 8)).toBe(76)
  })

  // A row taller than the box can only be shown from one end; the top is the readable one.
  it('aligns an oversized target to the top edge', () => {
    expect(scrollOffsetToReveal(container, { top: 90, bottom: 400 }, 8)).toBe(-18)
  })
})
