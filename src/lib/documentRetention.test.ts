import { describe, expect, it } from 'vitest'
import type { DocumentRetentionReview, RetentionTaxYearSummary } from '../types'
import {
  describeKeepUntil,
  groupRetentionReview,
  hasRetentionNotice,
  retentionNoticeHeading,
  EMPTY_RETENTION_REVIEW,
} from './documentRetention'

function year(taxYear: number, daysUntilKeepUntil: number): RetentionTaxYearSummary {
  return { taxYear, documentCount: 1, totalBytes: 10, keepUntil: '2033-12-31', daysUntilKeepUntil }
}

function review(...taxYears: RetentionTaxYearSummary[]): DocumentRetentionReview {
  return { taxYears, noticeWindowDays: 180, keepYears: 7 }
}

describe('describeKeepUntil', () => {
  it('never renders a negative day count as a future date', () => {
    // The bug this guards: "in -3 days".
    for (const days of [-1, -3, -29, -30, -364, -365, -1000]) {
      expect(describeKeepUntil(days)).toContain('ago')
      expect(describeKeepUntil(days)).not.toContain('-')
    }
  })

  it('reads as today on the day itself', () => {
    expect(describeKeepUntil(0)).toBe('today')
  })

  it('counts days below a month and singularises one', () => {
    expect(describeKeepUntil(1)).toBe('in 1 day')
    expect(describeKeepUntil(29)).toBe('in 29 days')
    expect(describeKeepUntil(-1)).toBe('1 day ago')
  })

  it('switches to months at a month and to years at a year', () => {
    expect(describeKeepUntil(30)).toBe('in about 1 month')
    expect(describeKeepUntil(150)).toBe('in about 5 months')
    expect(describeKeepUntil(364)).toBe('in about 12 months')
    expect(describeKeepUntil(365)).toBe('in about 1 year')
    expect(describeKeepUntil(-730)).toBe('about 2 years ago')
  })
})

describe('groupRetentionReview', () => {
  it('splits on the sign of the day count, counting today as not yet past', () => {
    const groups = groupRetentionReview(review(year(2018, -400), year(2020, 0), year(2021, 60)))

    expect(groups.past.map(entry => entry.taxYear)).toEqual([2018])
    expect(groups.approaching.map(entry => entry.taxYear)).toEqual([2020, 2021])
  })
})

describe('retentionNoticeHeading', () => {
  it('leads with the years that can be acted on today', () => {
    const withPast = groupRetentionReview(review(year(2018, -400), year(2021, 60)))
    expect(retentionNoticeHeading(withPast)).toBe('Some tax records are older than you need to keep')

    const approachingOnly = groupRetentionReview(review(year(2021, 60)))
    expect(retentionNoticeHeading(approachingOnly)).toBe('Some tax records can be cleared out soon')
  })
})

describe('hasRetentionNotice', () => {
  it('says nothing when there is nothing to say', () => {
    expect(hasRetentionNotice(EMPTY_RETENTION_REVIEW)).toBe(false)
    expect(hasRetentionNotice(review(year(2018, -1)))).toBe(true)
  })
})
