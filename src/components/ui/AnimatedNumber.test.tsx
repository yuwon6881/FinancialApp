import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { AnimatedNumber } from './AnimatedNumber'

afterEach(cleanup)

// The spring writes to the DOM outside React, so these assertions read textContent
// rather than relying on a re-render having happened.
const settle = async () => {
  // Let the spring run to completion. framer-motion drives frames off rAF/timers,
  // so yield repeatedly rather than assuming a fixed frame count.
  for (let i = 0; i < 60; i++) {
    await act(async () => { await new Promise(r => setTimeout(r, 16)) })
  }
}

describe('AnimatedNumber', () => {
  it('paints the formatted value synchronously on mount', () => {
    const { container } = render(<AnimatedNumber value={42.5} formatFn={(v) => `RM${v.toFixed(2)}`} />)
    expect(container.textContent).toBe('RM42.50')
  })

  it('settles on formatFn(value) after the spring completes', async () => {
    const format = (v: number) => v.toFixed(0) + '%'
    const { container, rerender } = render(<AnimatedNumber value={0} formatFn={format} />)
    expect(container.textContent).toBe('0%')

    rerender(<AnimatedNumber value={80} formatFn={format} />)
    await settle()

    expect(container.textContent).toBe('80%')
  })

  it('reformats immediately when only the formatter changes', () => {
    const { container, rerender } = render(<AnimatedNumber value={12} formatFn={(v) => `RM${v.toFixed(2)}`} />)
    expect(container.textContent).toBe('RM12.00')

    rerender(<AnimatedNumber value={12} formatFn={(v) => `$${v.toFixed(2)}`} />)
    expect(container.textContent).toBe('$12.00')
  })

  it('does not re-render on every animation frame', async () => {
    let renderCount = 0
    const Probe = ({ value }: { value: number }) => {
      renderCount++
      return <AnimatedNumber value={value} formatFn={(v) => v.toFixed(0)} />
    }
    const { rerender } = render(<Probe value={0} />)
    const afterMount = renderCount

    rerender(<Probe value={500} />)
    await settle()

    // One render for the prop change; the ~60 spring frames must not add any.
    expect(renderCount).toBe(afterMount + 1)
  })

  // The prefers-reduced-motion path lives in AnimatedNumber.reducedMotion.test.tsx:
  // framer-motion resolves the media query once per module instance, so it has to be
  // stubbed before the library is imported.
})
