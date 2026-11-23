import type { ForecastBucket, ForecastCycle } from '../types'
import { FORECAST_BUCKETS } from '../types'

export interface ForecastShortfall {
  bucket: ForecastBucket
  cycleLabel: string
  isCurrent: boolean
  /** The bucket's balance at the end of that cycle; negative by definition. */
  closing: number
}

/**
 * The first cycle each bucket runs short, in bucket order, so the page can lead with the answer
 * instead of making the user scan every card for a red mark.
 */
export function firstShortfalls(cycles: readonly ForecastCycle[]): ForecastShortfall[] {
  return FORECAST_BUCKETS.flatMap(bucket => {
    const cycle = cycles.find(candidate => candidate.shortBuckets.includes(bucket))
    return cycle ? [{ bucket, cycleLabel: cycle.label, isCurrent: cycle.isCurrent, closing: cycle.closing[bucket] }] : []
  })
}
