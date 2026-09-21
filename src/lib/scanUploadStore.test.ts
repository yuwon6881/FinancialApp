import { describe, expect, it } from 'vitest'
import {
  filterScanUploadsForOwner,
  normalizeScanUploadOwner,
  sortPendingScanUploadsForOwner,
} from './scanUploadStore'

const upload = (ownerId: string | undefined, createdAt: number, uploadId: string) => ({
  uploadId,
  ownerId: ownerId as string,
  kind: 'receipt' as const,
  blob: new Blob([uploadId]),
  fileName: `${uploadId}.jpg`,
  fileType: 'image/jpeg',
  createdAt,
})

describe('pending scan upload ownership and retention', () => {
  it('normalizes account names consistently and rejects an unknown owner', () => {
    expect(normalizeScanUploadOwner('  Alice@Example.com ')).toBe('alice@example.com')
    expect(normalizeScanUploadOwner('   ')).toBeNull()
  })

  it('does not expose or replay another account’s upload or an old unowned upload', () => {
    const records = [
      upload('alice@example.com', 1, 'alice-old'),
      upload('bob@example.com', 2, 'bob'),
      upload(undefined, 3, 'legacy-unowned'),
    ]
    expect(filterScanUploadsForOwner(records, 'ALICE@example.com').map(record => record.uploadId)).toEqual(['alice-old'])
    expect(filterScanUploadsForOwner(records, 'bob@example.com').map(record => record.uploadId)).toEqual(['bob'])
  })

  it('retains and orders an old unresolved upload until resolution or an explicit wipe', () => {
    const records = [
      upload('alice@example.com', Date.now() - 10 * 365 * 24 * 60 * 60 * 1000, 'old'),
      upload('alice@example.com', Date.now(), 'new'),
    ]
    expect(sortPendingScanUploadsForOwner(records, 'alice@example.com').map(record => record.uploadId)).toEqual(['old', 'new'])
  })
})
