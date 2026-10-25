import { useRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AnchoredPopover } from './AnchoredPopover'

function Harness({ onDismiss }: { onDismiss: () => void }) {
  const anchorRef = useRef<HTMLDivElement>(null)
  return (
    <>
      <div ref={anchorRef}><input aria-label="Description" /></div>
      <p>Elsewhere</p>
      <AnchoredPopover open anchorRef={anchorRef} onDismiss={onDismiss}>
        <span>Suggestion</span>
      </AnchoredPopover>
    </>
  )
}

function BesideHarness() {
  const anchorRef = useRef<HTMLSpanElement>(null)
  return (
    <>
      <span ref={anchorRef}>?</span>
      <AnchoredPopover open anchorRef={anchorRef} placement="beside" gap={8}>
        <span>Explanation</span>
      </AnchoredPopover>
    </>
  )
}

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect

describe('AnchoredPopover beside placement', () => {
  it('opens to the right of a small anchor with room there, instead of over what sits below it', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1440 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.textContent === '?' ? rect(250, 240, 20, 20) : rect(0, 0, 224, 60)
    })
    try {
      render(<BesideHarness />)
      const panel = screen.getByText('Explanation').parentElement!
      expect(panel.dataset.side).toBe('right')
      expect(panel.style.left).toBe('278px')
    } finally {
      spy.mockRestore()
    }
  })
})

describe('AnchoredPopover dismissal', () => {
  it('dismisses on a press outside the anchor and panel', () => {
    const onDismiss = vi.fn()
    render(<Harness onDismiss={onDismiss} />)
    fireEvent.pointerDown(screen.getByText('Elsewhere'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('stays open for presses on the anchor or inside the panel', () => {
    const onDismiss = vi.fn()
    render(<Harness onDismiss={onDismiss} />)
    fireEvent.pointerDown(screen.getByLabelText('Description'))
    fireEvent.pointerDown(screen.getByText('Suggestion'))
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
