import { describe, expect, it } from 'vitest'
import {
  REFRESH_HEADER_NAME,
  REFRESH_SLICES,
  collectRefreshHints,
  parseRefreshHeader,
  recordRefreshHeader,
} from './refreshSlices'

describe('refresh slice contract', () => {
  it('keeps the complete shared slice set and header name', () => {
    expect(REFRESH_HEADER_NAME).toBe('X-FinancialApp-Refresh-Slices')
    expect(REFRESH_SLICES).toEqual([
      'core', 'recurring', 'categories', 'wishlist', 'savingsGoals', 'loans', 'investments', 'documents',
    ])
  })

  it('fails closed for absent, malformed, duplicate, and unknown metadata', () => {
    for (const value of [null, '', 'core,core', 'core,unknown', 'core,']) {
      const parsed = parseRefreshHeader(value)
      expect(parsed.valid).toBe(false)
      expect(parsed.requiresFull).toBe(true)
    }
  })

  it('deduplicates valid slices across a mutation batch', async () => {
    const collected = await collectRefreshHints(async () => {
      recordRefreshHeader('core,recurring')
      recordRefreshHeader('recurring')
      return 7
    })

    expect(collected.value).toBe(7)
    expect(collected.hints).toEqual({
      slices: ['core', 'recurring'],
      requiresFull: false,
      seen: true,
    })
  })

  it('treats old APIs and explicit all markers as full-refresh fallbacks', async () => {
    const oldApi = await collectRefreshHints(async () => {
      recordRefreshHeader(null)
    })
    const all = parseRefreshHeader('all')
    expect(oldApi.hints.requiresFull).toBe(true)
    expect(all).toEqual({ valid: true, slices: [], requiresFull: true })
  })
})
