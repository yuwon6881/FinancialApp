import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useHighlightedElement } from './useHighlightedElement'

function Harness({ id, onClear, inRail = false }: { id: string; onClear: () => void; inRail?: boolean }) {
  useHighlightedElement(id, onClear)
  const target = <div id={id}>Target</div>
  return inRail ? <div className="horizontal-rail">{target}</div> : target
}

describe('useHighlightedElement', () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView

  afterEach(() => {
    vi.useRealTimers()
    Element.prototype.scrollIntoView = originalScrollIntoView
  })

  it('centers a searched rail card horizontally and applies the shared spotlight', () => {
    vi.useFakeTimers()
    const onClear = vi.fn()
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    const { container } = render(<Harness id="reward-card-last" onClear={onClear} inRail />)
    const target = container.querySelector<HTMLElement>('#reward-card-last')!
    const rail = container.querySelector<HTMLElement>('.horizontal-rail')!
    const scrollTo = vi.fn()
    rail.scrollTo = scrollTo
    Object.defineProperties(rail, {
      clientWidth: { value: 300 },
      scrollWidth: { value: 900 },
      scrollLeft: { value: 0, writable: true },
    })
    rail.getBoundingClientRect = () => ({ left: 0, right: 300, top: 0, bottom: 100, width: 300, height: 100, x: 0, y: 0, toJSON: () => ({}) })
    target.getBoundingClientRect = () => ({ left: 650, right: 850, top: 0, bottom: 100, width: 200, height: 100, x: 650, y: 0, toJSON: () => ({}) })

    act(() => vi.advanceTimersByTime(100))

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'smooth', left: 600 })
    expect(target.classList.contains('search-target-highlight')).toBe(true)

    act(() => vi.advanceTimersByTime(2600))
    expect(target.classList.contains('search-target-highlight')).toBe(false)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('does not start the missing-target deadline while the destination is loading', () => {
    vi.useFakeTimers()
    const onClear = vi.fn()
    const { rerender } = render(<LoadingHarness id="late-target" ready={false} onClear={onClear} />)

    act(() => vi.advanceTimersByTime(5000))
    expect(onClear).not.toHaveBeenCalled()

    rerender(<LoadingHarness id="late-target" ready onClear={onClear} />)
    act(() => vi.advanceTimersByTime(3600))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})

function LoadingHarness({ id, ready, onClear }: { id: string; ready: boolean; onClear: () => void }) {
  useHighlightedElement(id, onClear, { ready })
  return null
}
