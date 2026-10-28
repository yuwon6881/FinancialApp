import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { scrollEdgeMask, useScrollEdgeFade } from './useScrollEdgeFade'
import type { RefObject } from 'react'

describe('scrollEdgeMask', () => {
  it('returns undefined for {start:false,end:false}', () => {
    expect(scrollEdgeMask({ start: false, end: false })).toBeUndefined()
  })

  it('contains transparent first for start only', () => {
    const mask = scrollEdgeMask({ start: true, end: false })
    expect(mask).toBeDefined()
    expect(mask).toMatch(/^linear-gradient\(to right,\s*transparent/)
    expect(mask).toMatch(/#000\)$/)
  })

  it('contains transparent last for end only', () => {
    const mask = scrollEdgeMask({ start: false, end: true })
    expect(mask).toBeDefined()
    expect(mask).toMatch(/^linear-gradient\(to right,\s*#000/)
    expect(mask).toMatch(/transparent\)$/)
  })

  it('contains transparent at both ends when both start and end are set', () => {
    const mask = scrollEdgeMask({ start: true, end: true })
    expect(mask).toBeDefined()
    expect(mask).toMatch(/^linear-gradient\(to right,\s*transparent/)
    expect(mask).toMatch(/transparent\)$/)
  })
})

describe('useScrollEdgeFade', () => {
  function createMockElement({
    scrollWidth = 500,
    clientWidth = 300,
    scrollLeft = 0,
  }: {
    scrollWidth?: number
    clientWidth?: number
    scrollLeft?: number
  } = {}) {
    const el = document.createElement('div')
    let currentScrollLeft = scrollLeft
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth })
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth })
    Object.defineProperty(el, 'scrollLeft', {
      configurable: true,
      get: () => currentScrollLeft,
      set: (value: number) => { currentScrollLeft = value },
    })
    return el
  }

  it('measures overflowing content at scrollLeft 0 as end: true, start: false, and updates start to true on scroll', () => {
    const el = createMockElement({ scrollWidth: 500, clientWidth: 300, scrollLeft: 0 })
    const ref: RefObject<HTMLElement | null> = { current: el }

    const { result } = renderHook(() => useScrollEdgeFade(ref, 'key1'))

    expect(result.current.edges).toEqual({ start: false, end: true })
    expect(result.current.style).toEqual({
      maskImage: scrollEdgeMask({ start: false, end: true }),
      WebkitMaskImage: scrollEdgeMask({ start: false, end: true }),
    })

    el.scrollLeft = 100
    act(() => {
      result.current.onScroll()
    })

    expect(result.current.edges.start).toBe(true)
    expect(result.current.edges.end).toBe(true)
  })

  it('gives both false and style undefined when content fits', () => {
    const el = createMockElement({ scrollWidth: 300, clientWidth: 300, scrollLeft: 0 })
    const ref: RefObject<HTMLElement | null> = { current: el }

    const { result } = renderHook(() => useScrollEdgeFade(ref, 'key1'))

    expect(result.current.edges).toEqual({ start: false, end: false })
    expect(result.current.style).toBeUndefined()
  })

  it('gives both false when enabled=false', () => {
    const el = createMockElement({ scrollWidth: 500, clientWidth: 300, scrollLeft: 0 })
    const ref: RefObject<HTMLElement | null> = { current: el }

    const { result } = renderHook(() => useScrollEdgeFade(ref, 'key1', false))

    expect(result.current.edges).toEqual({ start: false, end: false })
    expect(result.current.style).toBeUndefined()
  })
})
