/**
 * Geometry shared by the investment line charts. Kept here so the portfolio chart
 * and the per-fund chart cannot drift into two slightly different ways of drawing
 * the same shape.
 *
 * Gaps are real: a missing price is `undefined` and is skipped rather than drawn
 * as zero, which would render a cliff down to the axis that never happened.
 */
export interface SeriesGeometry {
  width: number
  height: number
  /** Vertical breathing room so the line never touches the top or bottom edge. */
  padding?: number
  min: number
  max: number
}

export function seriesBounds(values: Array<number | undefined>, includeZero = true) {
  const present = values.filter((value): value is number => value !== undefined)
  if (present.length === 0) return { min: 0, max: 1 }
  const max = Math.max(...present, includeZero ? 0 : -Infinity)
  const min = Math.min(...present, includeZero ? 0 : Infinity)
  // A flat series would divide by zero; give it a band so it draws mid-height.
  return min === max ? { min: min - 1, max: max + 1 } : { min, max }
}

export function xAt(index: number, count: number, width: number) {
  return count <= 1 ? width / 2 : (index / (count - 1)) * width
}

export function yAt(value: number, { height, padding = 10, min, max }: SeriesGeometry) {
  return height - ((value - min) / (max - min || 1)) * (height - padding * 2) - padding
}

/**
 * SVG `points` for a filled confidence band: the upper edge left-to-right, then
 * the lower edge back right-to-left so the shape closes on itself.
 */
export function bandPolygon(upper: number[], lower: number[], geometry: SeriesGeometry) {
  const count = Math.min(upper.length, lower.length)
  const top = upper.slice(0, count).map((value, index) => `${xAt(index, count, geometry.width)},${yAt(value, geometry)}`)
  const bottom = lower.slice(0, count).map((value, index) => `${xAt(index, count, geometry.width)},${yAt(value, geometry)}`).reverse()
  return [...top, ...bottom].join(' ')
}

/** SVG `points` for a polyline, skipping entries with no value. */
export function polylinePoints(values: Array<number | undefined>, geometry: SeriesGeometry) {
  return values
    .map((value, index) => value === undefined
      ? null
      : `${xAt(index, values.length, geometry.width)},${yAt(value, geometry)}`)
    .filter(Boolean)
    .join(' ')
}
