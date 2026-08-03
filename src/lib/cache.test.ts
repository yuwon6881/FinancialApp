import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CACHE_KEYS, clearLocalFinancialData, getCachedJSON, getCachedWishlist, setCachedCycleSnapshot, setCachedJSON } from './cache'
import { obfuscateAmount } from './api/amounts'
import type { DashboardData } from '../types'

describe('setCachedJSON', () => {
  beforeEach(() => localStorage.clear())

  it('evicts only disposable caches when quota blocks an outbox write', () => {
    localStorage.setItem(CACHE_KEYS.dashboardData, JSON.stringify({ stale: true }))
    localStorage.setItem(CACHE_KEYS.pendingOperations, JSON.stringify([{ id: 'old-pending' }]))
    localStorage.setItem('failed_operations', JSON.stringify([{ id: 'old-failed' }]))

    const originalSetItem = Storage.prototype.setItem
    let shouldFail = true
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (shouldFail) {
        shouldFail = false
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }
      return originalSetItem.call(this, key, value)
    })

    const saved = setCachedJSON(CACHE_KEYS.pendingOperations, [{ id: 'new-pending' }])

    expect(saved).toBe(true)
    expect(localStorage.getItem(CACHE_KEYS.dashboardData)).toBeNull()
    expect(getCachedJSON(CACHE_KEYS.pendingOperations, [])).toEqual([{ id: 'new-pending' }])
    expect(getCachedJSON('failed_operations', [])).toEqual([{ id: 'old-failed' }])
    setItem.mockRestore()
  })

  it('returns false without deleting queues when storage remains unavailable', () => {
    localStorage.setItem(CACHE_KEYS.pendingOperations, JSON.stringify([{ id: 'pending' }]))
    localStorage.setItem('failed_operations', JSON.stringify([{ id: 'failed' }]))
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    expect(() => setCachedJSON(CACHE_KEYS.pendingOperations, [{ id: 'new' }])).not.toThrow()
    expect(setCachedJSON(CACHE_KEYS.pendingOperations, [{ id: 'new' }])).toBe(false)
    expect(getCachedJSON(CACHE_KEYS.pendingOperations, [])).toEqual([{ id: 'pending' }])
    expect(getCachedJSON('failed_operations', [])).toEqual([{ id: 'failed' }])
    setItem.mockRestore()
  })

  it('makes cycle snapshot writes non-fatal', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    expect(() => setCachedCycleSnapshot('Jul', 2026, {} as DashboardData, [])).not.toThrow()
    setItem.mockRestore()
  })

  it('continues clearing other local data when one storage removal throws', () => {
    localStorage.setItem(CACHE_KEYS.dashboardData, JSON.stringify({ stale: true }))
    localStorage.setItem(CACHE_KEYS.transactions, JSON.stringify([{ id: 'cached-transaction' }]))
    localStorage.setItem('draft_transactions', JSON.stringify([{ id: 'draft-transaction' }]))

    const originalRemoveItem = Storage.prototype.removeItem
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
      if (key === CACHE_KEYS.dashboardData) {
        throw new DOMException('Storage unavailable', 'SecurityError')
      }
      return originalRemoveItem.call(this, key)
    })

    expect(() => clearLocalFinancialData()).not.toThrow()
    expect(localStorage.getItem(CACHE_KEYS.dashboardData)).not.toBeNull()
    expect(localStorage.getItem(CACHE_KEYS.transactions)).toBeNull()
    expect(localStorage.getItem('draft_transactions')).toBeNull()
    removeItem.mockRestore()
  })
})

describe('cached amount decoding', () => {
  beforeEach(() => localStorage.clear())

  const wish = (price: unknown) => ({
    id: 1,
    name: 'Headphones',
    priority: 'Medium',
    isPurchased: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    isActive: false,
    price,
  })

  const priceOf = (price: unknown): number => {
    localStorage.setItem(CACHE_KEYS.wishlist, JSON.stringify([wish(price)]))
    return getCachedWishlist(CACHE_KEYS.wishlist)[0].price
  }

  // The decision between "obfuscated" and "legacy plaintext" used to be made by asking
  // whether the string parses as a number. The base64 alphabet contains digits, so an
  // obfuscated amount can satisfy that test and was then returned raw — a wildly wrong
  // figure. The obfuscated form is now decided on its decoded shape instead, so it wins
  // whenever it genuinely is one.
  it('decodes obfuscated amounts rather than coercing the encoded string', () => {
    for (const amount of [300, 0.5, 1234.56, -42.75, 12345678]) {
      expect(priceOf(obfuscateAmount(amount))).toBeCloseTo(amount, 2)
    }
  })

  it('still reads plain numbers and legacy plaintext strings', () => {
    expect(priceOf(300)).toBe(300)
    expect(priceOf('300')).toBe(300)
    expect(priceOf('300.00')).toBe(300)
    expect(priceOf('-42.75')).toBe(-42.75)
    // Four digits are valid base64, so this is the case where both readings are possible.
    // It does not decode to anything money-shaped, so the plaintext reading stands.
    expect(priceOf('1234')).toBe(1234)
  })

  it('falls back to zero for values that are neither', () => {
    expect(priceOf('not-an-amount')).toBe(0)
    expect(priceOf(null)).toBe(0)
    expect(priceOf(Number.NaN)).toBe(0)
  })
})

describe('setCachedJSON quota eviction', () => {
  beforeEach(() => localStorage.clear())

  // A marginal overrun used to cost every stale-while-revalidate cache at once, so the
  // next open re-fetched the dashboard, ledger, wishlist, investments and settings. It
  // now evicts one at a time and retries, stopping as soon as the write fits.
  it('stops evicting as soon as the write succeeds', () => {
    localStorage.setItem(CACHE_KEYS.dashboardData, JSON.stringify({ stale: true }))
    localStorage.setItem(CACHE_KEYS.transactions, JSON.stringify([{ id: 'keep-me' }]))
    localStorage.setItem(CACHE_KEYS.wishlist, JSON.stringify([{ id: 'keep-me-too' }]))

    const originalSetItem = Storage.prototype.setItem
    let failuresLeft = 1
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (failuresLeft > 0) {
        failuresLeft -= 1
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }
      return originalSetItem.call(this, key, value)
    })

    try {
      expect(setCachedJSON(CACHE_KEYS.pendingOperations, [{ id: 'new-pending' }])).toBe(true)
    } finally {
      setItem.mockRestore()
    }

    // Only the first disposable cache was sacrificed; the rest survived.
    expect(localStorage.getItem(CACHE_KEYS.dashboardData)).toBeNull()
    expect(getCachedJSON(CACHE_KEYS.transactions, [])).toEqual([{ id: 'keep-me' }])
    expect(getCachedJSON(CACHE_KEYS.wishlist, [])).toEqual([{ id: 'keep-me-too' }])
    expect(getCachedJSON(CACHE_KEYS.pendingOperations, [])).toEqual([{ id: 'new-pending' }])
  })
})
