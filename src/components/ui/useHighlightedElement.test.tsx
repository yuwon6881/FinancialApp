import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useHighlightedElement } from './useHighlightedElement'

function Harness({ id, onClear }: { id: string; onClear: () => void }) {
  useHighlightedElement(id, onClear)
  return <div id={id}>Target</div>
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
    const { container } = render(<Harness id="reward-card-last" onClear={onClear} />)
    const target = container.querySelector('#reward-card-last')!

    act(() => vi.advanceTimersByTime(100))

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center', inline: 'center' })
    expect(target.classList.contains('search-target-highlight')).toBe(true)

    act(() => vi.advanceTimersByTime(2600))
    expect(target.classList.contains('search-target-highlight')).toBe(false)
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
