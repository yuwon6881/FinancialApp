import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CACHE_KEYS, clearLocalFinancialData, getCachedJSON, setCachedCycleSnapshot, setCachedJSON } from './cache'
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
