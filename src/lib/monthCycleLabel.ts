/** A month-only financial cycle label, optionally shifted by whole cycles. */
export function getMonthCycleLabel(cycleKey: string, offset = 0): string | undefined {
  if (!/^\d{4}-\d{2}$/.test(cycleKey)) return undefined
  const [year, month] = cycleKey.split('-').map(Number)
  if (month < 1 || month > 12) return undefined
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  return `${label} cycle`
}
