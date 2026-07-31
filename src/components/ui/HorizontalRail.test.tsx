import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HorizontalRail } from './HorizontalRail'

describe('HorizontalRail', () => {
  it('consumes vertical wheel input while it can move sideways and hands it back at the edges', () => {
    const { getByRole } = render(
      <HorizontalRail label="Rewards">
        <div>First</div>
        <div>Second</div>
      </HorizontalRail>,
    )
    const rail = getByRole('group', { name: 'Rewards' })
    let scrollLeft = 0

    Object.defineProperties(rail, {
      scrollWidth: { configurable: true, value: 1_000 },
      clientWidth: { configurable: true, value: 300 },
      scrollLeft: {
        configurable: true,
        get: () => scrollLeft,
        set: (value: number) => { scrollLeft = value },
      },
    })

    const forward = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 })
    const forwardPreventDefault = vi.spyOn(forward, 'preventDefault')
    rail.dispatchEvent(forward)

    expect(scrollLeft).toBe(120)
    expect(forwardPreventDefault).toHaveBeenCalledOnce()

    scrollLeft = 700
    const beyondEnd = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 })
    const beyondEndPreventDefault = vi.spyOn(beyondEnd, 'preventDefault')
    rail.dispatchEvent(beyondEnd)

    expect(scrollLeft).toBe(700)
    expect(beyondEndPreventDefault).not.toHaveBeenCalled()

    scrollLeft = 300
    const horizontalTrackpad = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: -80 })
    const horizontalPreventDefault = vi.spyOn(horizontalTrackpad, 'preventDefault')
    rail.dispatchEvent(horizontalTrackpad)

    expect(scrollLeft).toBe(220)
    expect(horizontalPreventDefault).toHaveBeenCalledOnce()
  })
})
