import { describe, expect, it } from 'vitest'
import { describeLocalDataWipe } from './localDataWipe'

describe('local data wipe confirmation', () => {
  it('includes queued scan images in the permanent-loss warning', () => {
    expect(describeLocalDataWipe({
      unsyncedChangeCount: 1,
      draftCount: 2,
      scanUploadCount: 3,
      hasPendingLocalChanges: true,
    })).toBe('1 change has not synced yet and 2 drafts are saved only on this device and 3 saved scan images are waiting to upload. Clearing removes them permanently.')
  })

  it('does not claim that no work will be lost when the scan queue count is unavailable', () => {
    expect(describeLocalDataWipe({
      unsyncedChangeCount: 0,
      draftCount: 0,
      scanUploadCount: null,
      hasPendingLocalChanges: false,
    })).toBe('the number of saved scan images could not be checked. Clearing removes them permanently.')
  })

  it('uses the ordinary cache-removal message when every durable queue is empty', () => {
    expect(describeLocalDataWipe({
      unsyncedChangeCount: 0,
      draftCount: 0,
      scanUploadCount: 0,
      hasPendingLocalChanges: false,
    })).toContain('Your account is unaffected.')
  })
})
