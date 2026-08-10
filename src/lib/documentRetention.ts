import type { DocumentRetentionReview, RetentionTaxYearSummary } from '../types'

/**
 * Reading of the server's retention review: which years can be cleared out, which are getting
 * close, and how to say so in words. Pure — no React and no HTTP — so both the Vault and the
 * Dashboard can share one wording without sharing a component's internals.
 *
 * The thresholds are all the server's. Nothing here decides what counts as "soon".
 */

/** Safe starting value, so a screen can render before the review has loaded. */
export const EMPTY_RETENTION_REVIEW: DocumentRetentionReview = {
  taxYears: [],
  noticeWindowDays: 0,
  keepYears: 7,
}

export function hasRetentionNotice(review: DocumentRetentionReview): boolean {
  return review.taxYears.length > 0
}

export interface RetentionGroups {
  /** Past the date they were worth keeping — safe to clear out. */
  past: RetentionTaxYearSummary[]
  /** Not there yet, but close enough to say so before it is too late. */
  approaching: RetentionTaxYearSummary[]
}

export function groupRetentionReview(review: DocumentRetentionReview): RetentionGroups {
  return {
    past: review.taxYears.filter(year => year.daysUntilKeepUntil < 0),
    approaching: review.taxYears.filter(year => year.daysUntilKeepUntil >= 0),
  }
}

/** A past group outranks an approaching one: it is the one the user can act on today. */
export function retentionNoticeHeading(groups: RetentionGroups): string {
  return groups.past.length > 0
    ? 'Some tax records are older than you need to keep'
    : 'Some tax records can be cleared out soon'
}

const DAYS_PER_MONTH = 30
const DAYS_PER_YEAR = 365

/**
 * Turns a day count into something a person would say. Deliberately vague past a month — the exact
 * date is on the same line, so a precise day count there would be noise, and "in 154 days" is not
 * how anyone thinks about a filing deadline.
 */
export function describeKeepUntil(daysUntilKeepUntil: number): string {
  if (daysUntilKeepUntil === 0) return 'today'
  const magnitude = Math.abs(daysUntilKeepUntil)
  const isPast = daysUntilKeepUntil < 0
  const span = describeSpan(magnitude)
  return isPast ? `${span} ago` : `in ${span}`
}

function describeSpan(days: number): string {
  if (days < DAYS_PER_MONTH) return days === 1 ? '1 day' : `${days} days`
  if (days < DAYS_PER_YEAR) {
    const months = Math.max(1, Math.round(days / DAYS_PER_MONTH))
    return months === 1 ? 'about 1 month' : `about ${months} months`
  }
  const years = Math.floor(days / DAYS_PER_YEAR)
  return years === 1 ? 'about 1 year' : `about ${years} years`
}
