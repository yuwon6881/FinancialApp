import { afterEach, describe, expect, it, vi } from 'vitest'
import { motionSafeScrollBehavior, prefersReducedMotion } from './motionPreference'

describe('motion preference helpers', () => {
  afterEach(() => vi.restoreAllMocks())

  it('keeps smooth scrolling for users without a reduced-motion preference', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
    expect(prefersReducedMotion()).toBe(false)
    expect(motionSafeScrollBehavior()).toBe('smooth')
  })

  it('turns imperative smooth scrolling off when reduced motion is requested', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    expect(prefersReducedMotion()).toBe(true)
    expect(motionSafeScrollBehavior()).toBe('auto')
  })
})
