import { describe, it, expect, beforeAll, afterEach } from 'vitest'

// framer-motion caches the prefers-reduced-motion result the first time useReducedMotion
// runs and keeps it for the module's lifetime, so the stub has to be installed before the
// library is imported. That means this case needs a file of its own rather than a
// beforeEach in AnimatedNumber.test.tsx.
const matchMediaStub = (query: string) => ({
  matches: query.includes('prefers-reduced-motion'),
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})

let render: typeof import('@testing-library/react')['render']
let cleanup: typeof import('@testing-library/react')['cleanup']
let AnimatedNumber: typeof import('./AnimatedNumber')['AnimatedNumber']

beforeAll(async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true, writable: true, value: matchMediaStub,
  })
  const rtl = await import('@testing-library/react')
  render = rtl.render
  cleanup = rtl.cleanup
  AnimatedNumber = (await import('./AnimatedNumber')).AnimatedNumber
})

afterEach(() => cleanup())

describe('AnimatedNumber under prefers-reduced-motion', () => {
  it('lands on the final value without interpolating', () => {
    const format = (v: number) => v.toFixed(0)
    const { container, rerender } = render(<AnimatedNumber value={0} formatFn={format} />)
    expect(container.textContent).toBe('0')

    rerender(<AnimatedNumber value={900} formatFn={format} />)

    // No frames awaited: the value must already be final.
    expect(container.textContent).toBe('900')
  })
})
