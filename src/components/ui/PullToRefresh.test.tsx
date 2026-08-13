import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PullToRefresh } from './PullToRefresh'

describe('PullToRefresh accessibility', () => {
  it('keeps its status silent while idle and provides a plain-language refresh label', () => {
    window.innerWidth = 500
    render(<PullToRefresh onRefresh={vi.fn()}><p>Page content</p></PullToRefresh>)

    const status = screen.getByRole('status', { hidden: true })
    expect(status.getAttribute('aria-hidden')).toBe('true')
    expect(status.getAttribute('aria-label')).toBe('Pull down to refresh')
  })

  it('hands a dominant horizontal gesture to swipeable rows before tracking a pull', () => {
    window.innerWidth = 500
    const onRefresh = vi.fn()
    render(<PullToRefresh onRefresh={onRefresh}><p>Page content</p></PullToRefresh>)

    fireEvent.touchStart(window, {
      touches: [{ clientX: 120, clientY: 40 }],
    })
    fireEvent.touchMove(window, {
      touches: [{ clientX: 190, clientY: 62 }],
      cancelable: true,
    })

    const status = screen.getByRole('status', { hidden: true })
    expect(status.getAttribute('aria-hidden')).toBe('true')
    expect(onRefresh).not.toHaveBeenCalled()
  })
})
