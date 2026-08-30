import { describe, expect, it } from 'vitest'
import { BREAKPOINTS, DENSE_CONTENT_BREAKPOINT, getSizeClass, isDenseContentWidth } from './breakpoints'

describe('responsive window size classes', () => {
  it('uses compact, medium, and expanded at the shared boundaries', () => {
    expect(BREAKPOINTS).toEqual({ medium: 640, expanded: 1024 })
    expect(getSizeClass(320)).toBe('compact')
    expect(getSizeClass(639.999)).toBe('compact')
    expect(getSizeClass(640)).toBe('medium')
    expect(getSizeClass(1023.999)).toBe('medium')
    expect(getSizeClass(1024)).toBe('expanded')
  })

  it('keeps data-dense tables out of laptop layouts narrowed by the navigation rail', () => {
    expect(DENSE_CONTENT_BREAKPOINT).toBe(1280)
    expect(isDenseContentWidth(1279.999)).toBe(false)
    expect(isDenseContentWidth(1280)).toBe(true)
  })
})
