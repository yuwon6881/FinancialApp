/**
 * Internal rate of return for irregularly dated cash flows (the XIRR a spreadsheet
 * computes).
 *
 * Deliberately conservative: every path that cannot be trusted returns `undefined`
 * rather than a plausible-looking number. A wrong return figure is worse than an
 * absent one, because the reader has no way to tell it is wrong.
 */
export interface DatedFlow {
  /** ISO date (YYYY-MM-DD). */
  date: string
  /** Negative when money leaves your pocket, positive when it comes back. */
  amount: number
}

const DAYS_PER_YEAR = 365
const MAX_ITERATIONS = 120
const TOLERANCE = 1e-7
/** Below -99.99%/yr or above 1e7%/yr the answer is noise, not information. */
const MIN_RATE = -0.9999
const MAX_RATE = 1e5

const yearsBetween = (from: number, to: number) => (to - from) / (1000 * 60 * 60 * 24 * DAYS_PER_YEAR)

function presentValue(flows: Array<{ years: number; amount: number }>, rate: number) {
  return flows.reduce((sum, flow) => sum + flow.amount / Math.pow(1 + rate, flow.years), 0)
}

export function xirr(flows: DatedFlow[]): number | undefined {
  const parsed = flows
    .map(flow => ({ time: Date.parse(flow.date), amount: flow.amount }))
    .filter(flow => Number.isFinite(flow.time) && Number.isFinite(flow.amount) && flow.amount !== 0)
  if (parsed.length < 2) return undefined

  // Without both an outflow and an inflow there is no rate that balances them.
  const hasNegative = parsed.some(flow => flow.amount < 0)
  const hasPositive = parsed.some(flow => flow.amount > 0)
  if (!hasNegative || !hasPositive) return undefined

  const start = Math.min(...parsed.map(flow => flow.time))
  const end = Math.max(...parsed.map(flow => flow.time))
  // All on one day: there is no elapsed time to spread a return over.
  if (end === start) return undefined

  const normalised = parsed.map(flow => ({ years: yearsBetween(start, flow.time), amount: flow.amount }))

  // Bisection first: it cannot diverge, and it brackets the root for the refinement
  // step below. Newton alone wanders off on the lumpy flows a real ledger produces.
  let low = MIN_RATE
  let high = MAX_RATE
  let lowValue = presentValue(normalised, low)
  const highValue = presentValue(normalised, high)
  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue)) return undefined
  // Same sign at both ends means no root is bracketed, so there is nothing to find.
  if (lowValue * highValue > 0) return undefined

  let rate = 0
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    rate = (low + high) / 2
    const value = presentValue(normalised, rate)
    if (!Number.isFinite(value)) return undefined
    if (Math.abs(value) < TOLERANCE || high - low < TOLERANCE) return rate
    if (value * lowValue < 0) {
      high = rate
    } else {
      low = rate
      lowValue = value
    }
  }
  return Math.abs(presentValue(normalised, rate)) < 1e-3 ? rate : undefined
}
