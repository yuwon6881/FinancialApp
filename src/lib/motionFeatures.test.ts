import { describe, it, expect } from 'vitest'
import domMax from './motionFeatures'

// motionFeatures reaches inside framer-motion's dist (via the `framer-motion-features`
// alias in vite.config.ts) because the package's exports map does not publish its feature
// bundles separately, and routing the import through the package root defeats
// LazyMotion's code-splitting entirely.
//
// That path is not public API, so this test is the tripwire: if a framer-motion upgrade
// moves or renames the module, this fails loudly instead of the app silently losing drag
// gestures — or silently pulling the whole feature bundle back onto the critical path.
describe('motionFeatures', () => {
  it('resolves to a Framer Motion feature bundle', () => {
    expect(domMax).toBeTypeOf('object')
    expect(domMax).not.toBeNull()
  })

  it('includes the drag and layout features the app depends on', () => {
    // SwipeableRow, BottomSheet and ToastViewport need drag; ToastViewport and the
    // investment-plan Reorder list need layout projection. domAnimation has neither,
    // which is why this is the `max` bundle.
    const keys = Object.keys(domMax)
    expect(keys).toContain('drag')
    expect(keys).toContain('layout')
    expect(keys).toContain('animation')
  })
})
