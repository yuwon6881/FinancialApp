import { describe, expect, it } from 'vitest'
import { PENDING_SCAN_UPLOAD_TTL_MS, isExpiredScanUpload } from './scanUploadStore'

describe('pending scan upload expiry', () => {
  // Matched to the server's own terminal job retention: a scan started later than this would be
  // pruned before its result could ever be read back.
  it('matches the server job retention window', () => {
    expect(PENDING_SCAN_UPLOAD_TTL_MS).toBe(24 * 60 * 60 * 1000)
  })

  it('keeps an image right up to the window and drops it after', () => {
    const now = 1_000_000_000_000
    expect(isExpiredScanUpload({ createdAt: now - PENDING_SCAN_UPLOAD_TTL_MS }, now)).toBe(false)
    expect(isExpiredScanUpload({ createdAt: now - PENDING_SCAN_UPLOAD_TTL_MS - 1 }, now)).toBe(true)
  })

  // A clock that jumped backwards must not make every queued upload look expired.
  it('treats an image from the future as still owed', () => {
    expect(isExpiredScanUpload({ createdAt: 2_000 }, 1_000)).toBe(false)
  })
})
