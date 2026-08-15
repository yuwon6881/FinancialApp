import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chartRanges } from '../../lib/investmentChartRanges'

interface ChartRangeCase {
  range: string
  expectedPoints: number
  inputPoints: number
}

const fixture = JSON.parse(readFileSync(new URL('./fixtures/chart-range.cases.json', import.meta.url), 'utf8')) as {
  cases: ChartRangeCase[]
}

describe('chart range parity fixture', () => {
  it('offers exactly the ranges understood by the backend', () => {
    expect(chartRanges.map(range => range.value)).toEqual(
      fixture.cases.map(value => value.range),
    )
  })

  it('keeps every sampled series within the backend cap and keeps the newest point', () => {
    for (const value of fixture.cases) {
      const points = Array.from({ length: value.inputPoints }, (_, index) => index)
      const interval = Math.ceil(points.length / 180)
      const sampled = points.filter((_, index) => index % interval === 0)
      if (sampled.at(-1) !== points.at(-1)) sampled.push(points.at(-1)!)
      expect(sampled.length).toBe(value.expectedPoints)
      expect(sampled.length).toBeLessThanOrEqual(181)
      expect(sampled.at(-1)).toBe(points.at(-1))
    }
  })
})
