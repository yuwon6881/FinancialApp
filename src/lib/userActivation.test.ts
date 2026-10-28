import { afterEach, describe, expect, it } from 'vitest'
import { hasUserActivation } from './userActivation'

describe('hasUserActivation', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'userActivation')

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'userActivation', originalDescriptor)
    } else {
      delete (navigator as unknown as { userActivation?: unknown }).userActivation
    }
  })

  it('returns true when navigator has no userActivation property', () => {
    delete (navigator as unknown as { userActivation?: unknown }).userActivation
    expect(hasUserActivation()).toBe(true)
  })

  it('returns false when userActivation hasBeenActive is false', () => {
    Object.defineProperty(navigator, 'userActivation', {
      configurable: true,
      value: { hasBeenActive: false },
    })
    expect(hasUserActivation()).toBe(false)
  })

  it('returns true when userActivation hasBeenActive is true', () => {
    Object.defineProperty(navigator, 'userActivation', {
      configurable: true,
      value: { hasBeenActive: true },
    })
    expect(hasUserActivation()).toBe(true)
  })
})
