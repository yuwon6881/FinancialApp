import { describe, expect, it } from 'vitest'
import { polylinePoints, seriesBounds, xAt, yAt } from './chartSeries'

describe('seriesBounds', () => {
  it('ignores gaps and anchors to zero so gains read against a stable floor', () => {
    expect(seriesBounds([10, undefined, 40])).toEqual({ min: 0, max: 40 })
  })

  it('gives a flat series a band instead of dividing by zero', () => {
    expect(seriesBounds([25, 25], false)).toEqual({ min: 24, max: 26 })
  })

  it('falls back to a unit band when nothing is known', () => {
    expect(seriesBounds([undefined, undefined])).toEqual({ min: 0, max: 1 })
  })

  it('can track a series on its own scale rather than from zero', () => {
    expect(seriesBounds([100, 120], false)).toEqual({ min: 100, max: 120 })
  })
})

describe('polylinePoints', () => {
  const geometry = { width: 100, height: 100, padding: 10, min: 0, max: 100 }

  it('spreads points across the width and inverts the y axis', () => {
    expect(polylinePoints([0, 100], geometry)).toBe('0,90 100,10')
  })

  it('skips gaps rather than drawing them as zero', () => {
    expect(polylinePoints([0, undefined, 100], geometry)).toBe('0,90 100,10')
  })

  it('centres a lone point', () => {
    expect(xAt(0, 1, 100)).toBe(50)
  })

  it('keeps a flat line off the edges', () => {
    expect(yAt(50, geometry)).toBe(50)
  })
})
