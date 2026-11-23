/** Keep a split at its requested total even when rounding several small groups up. */
export function roundInvestmentSplit(raw: number[], total: number, limits?: number[]): number[] {
  const cents = raw.map((value, index) => Math.round(Math.min(value, limits?.[index] ?? Infinity) * 100))
  let difference = Math.round(total * 100) - cents.reduce((sum, value) => sum + value, 0)
  if (difference !== 0) {
    const largestFirst = cents.map((_, index) => index).sort((left, right) => cents[right] - cents[left])
    for (const index of largestFirst) {
      const available = limits ? Math.max(0, Math.round(limits[index] * 100) - cents[index]) : Infinity
      const correction = Math.max(-cents[index], Math.min(difference, available))
      cents[index] += correction
      difference -= correction
      if (difference === 0) break
    }
  }
  return cents.map(value => value / 100)
}
