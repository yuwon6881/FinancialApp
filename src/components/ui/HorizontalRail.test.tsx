import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HorizontalRail } from './HorizontalRail'

describe('HorizontalRail', () => {
  it('consumes vertical wheel input while it can move sideways and hands it back at the edges', () => {
    const { getByRole } = render(
      <HorizontalRail label="Rewards">
        <button type="button">First</button>
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
    fireEvent(getByRole('button', { name: 'First' }), forward)

    expect(scrollLeft).toBe(120)
    expect(forwardPreventDefault).toHaveBeenCalledOnce()

    scrollLeft = 700
    const beyondEnd = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 })
    const beyondEndPreventDefault = vi.spyOn(beyondEnd, 'preventDefault')
    fireEvent(rail, beyondEnd)

    expect(scrollLeft).toBe(700)
    expect(beyondEndPreventDefault).not.toHaveBeenCalled()

    scrollLeft = 300
    const horizontalTrackpad = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: -80 })
    const horizontalPreventDefault = vi.spyOn(horizontalTrackpad, 'preventDefault')
    fireEvent(rail, horizontalTrackpad)

    expect(scrollLeft).toBe(220)
    expect(horizontalPreventDefault).toHaveBeenCalledOnce()
  })

  it('offers desktop navigation controls only in directions with remaining content', () => {
    const { getByRole, queryByRole } = render(
      <HorizontalRail label="Commitments" showControls>
        <div>First</div>
        <div>Second</div>
      </HorizontalRail>,
    )
    const rail = getByRole('group', { name: 'Commitments' })
    let scrollLeft = 0
    const scrollBy = vi.fn()

    Object.defineProperties(rail, {
      scrollWidth: { configurable: true, value: 1_000 },
      clientWidth: { configurable: true, value: 300 },
      scrollLeft: {
        configurable: true,
        get: () => scrollLeft,
        set: (value: number) => { scrollLeft = value },
      },
      scrollBy: { configurable: true, value: scrollBy },
    })
    fireEvent.scroll(rail)

    expect(queryByRole('button', { name: 'Scroll Commitments left' })).toBeNull()
    fireEvent.click(getByRole('button', { name: 'Scroll Commitments right' }))
    expect(scrollBy).toHaveBeenCalledWith({ left: 240, behavior: 'smooth' })

    scrollLeft = 700
    fireEvent.scroll(rail)
    expect(getByRole('button', { name: 'Scroll Commitments left' })).not.toBeNull()
    expect(queryByRole('button', { name: 'Scroll Commitments right' })).toBeNull()
  })
})
