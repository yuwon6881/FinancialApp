/** A month-only label (e.g. "Aug 2026"), optionally shifted by whole cycles. */
export function getMonthLabel(cycleKey: string, offset = 0): string | undefined {
  if (!/^\d{4}-\d{2}$/.test(cycleKey)) return undefined
  const [year, month] = cycleKey.split('-').map(Number)
  if (month < 1 || month > 12) return undefined
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** A month-only financial cycle label, optionally shifted by whole cycles. */
export function getMonthCycleLabel(cycleKey: string, offset = 0): string | undefined {
  const label = getMonthLabel(cycleKey, offset)
  return label ? `${label} cycle` : undefined
}
