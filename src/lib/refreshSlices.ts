/**
 * Additive server-refresh metadata. The values intentionally mirror the API contract and the
 * root parity fixture; do not silently add a client-only slice here.
 */
export const REFRESH_HEADER_NAME = 'X-FinancialApp-Refresh-Slices'
export const REFRESH_SLICES = [
  'core',
  'recurring',
  'categories',
  'wishlist',
  'savingsGoals',
  'loans',
  'investments',
  'documents',
] as const

export type RefreshSlice = typeof REFRESH_SLICES[number]

const knownSlices = new Set<string>(REFRESH_SLICES)

export interface RefreshHintSummary {
  /** The known slices named by successful mutation responses. */
  slices: RefreshSlice[]
  /** True when a response was absent/malformed or explicitly requested a full bootstrap. */
  requiresFull: boolean
  /** False when no unsafe response was observed (useful for test doubles). */
  seen: boolean
}

export interface ParsedRefreshHeader {
  valid: boolean
  slices: RefreshSlice[]
  requiresFull: boolean
}

export function parseRefreshHeader(value: string | null | undefined): ParsedRefreshHeader {
  if (value == null) return { valid: false, slices: [], requiresFull: true }
  const trimmed = value.trim()
  // Non-financial mutations explicitly opt out so a batch containing login/session plumbing
  // cannot trigger a needless bootstrap.
  if (trimmed === 'none') return { valid: true, slices: [], requiresFull: false }
  // A conservative server default remains a valid instruction to use the old full path.
  if (trimmed === 'all') return { valid: true, slices: [], requiresFull: true }
  if (!trimmed) return { valid: false, slices: [], requiresFull: true }

  const values = trimmed.split(',').map(value => value.trim())
  if (values.some(value => !value) || values.some(value => !knownSlices.has(value))) {
    return { valid: false, slices: [], requiresFull: true }
  }
  const distinct = [...new Set(values)]
  if (distinct.length !== values.length) {
    return { valid: false, slices: [], requiresFull: true }
  }
  return {
    valid: true,
    slices: distinct as RefreshSlice[],
    requiresFull: false,
  }
}

type Collector = {
  summary: RefreshHintSummary
}

const collectors = new Set<Collector>()

/** Records one successful unsafe response for every active outbox/direct-mutation collector. */
export function recordRefreshHeader(value: string | null | undefined): void {
  const parsed = parseRefreshHeader(value)
  for (const collector of collectors) {
    collector.summary.seen = true
    if (!parsed.valid || parsed.requiresFull) collector.summary.requiresFull = true
    for (const slice of parsed.slices) {
      if (!collector.summary.slices.includes(slice)) collector.summary.slices.push(slice)
    }
  }
}

/**
 * Collects headers across a sequential or concurrent mutation batch. The callback remains the
 * caller's authoritative work; a failed callback is rethrown without converting a failed write
 * into a refresh request.
 */
export async function collectRefreshHints<T>(work: () => Promise<T>): Promise<{ value: T; hints: RefreshHintSummary }> {
  const collector: Collector = {
    summary: { slices: [], requiresFull: false, seen: false },
  }
  collectors.add(collector)
  try {
    const value = await work()
    return {
      value,
      hints: {
        slices: [...collector.summary.slices],
        requiresFull: collector.summary.requiresFull,
        seen: collector.summary.seen,
      },
    }
  } finally {
    collectors.delete(collector)
  }
}

/** Starts a collector that can span the outbox dispatch and its reconciliation callback. */
export function beginRefreshHintCollection(): {
  finish: () => RefreshHintSummary
  dispose: () => void
} {
  const collector: Collector = {
    summary: { slices: [], requiresFull: false, seen: false },
  }
  collectors.add(collector)
  let disposed = false
  const finish = () => ({
    slices: [...collector.summary.slices],
    requiresFull: collector.summary.requiresFull,
    seen: collector.summary.seen,
  })
  return {
    finish,
    dispose: () => {
      if (disposed) return
      disposed = true
      collectors.delete(collector)
    },
  }
}
