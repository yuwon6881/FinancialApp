import { describe, expect, it } from 'vitest'
import {
  FALLBACK_ACCEPTED_UPLOAD_TYPES,
  FALLBACK_DOCUMENT_CONSTRAINTS,
  formatUploadMegabytes,
  normalizeDocumentConstraints,
} from './documentUploadTypes'

describe('normalizeDocumentConstraints', () => {
  it('keeps a well-formed response as-is', () => {
    const loaded = {
      maxDocumentBytes: 5 * 1024 * 1024,
      maxBulkDocuments: 3,
      maxTotalBytesPerUser: 100 * 1024 * 1024,
      acceptedUploadTypes: ['application/pdf'],
    }
    expect(normalizeDocumentConstraints(loaded)).toEqual(loaded)
  })

  // The guard is `file.size > maxDocumentBytes`. Against undefined that is false for every file,
  // so an empty or malformed response stopped the size limit being enforced at all.
  it.each([
    ['an empty object', {}],
    ['an empty array from a catch-all route', [] as unknown as Record<string, never>],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to the mirrored server defaults for %s', (_label, loaded) => {
    const normalized = normalizeDocumentConstraints(loaded)
    expect(normalized.maxDocumentBytes).toBe(FALLBACK_DOCUMENT_CONSTRAINTS.maxDocumentBytes)
    expect(normalized.maxBulkDocuments).toBe(FALLBACK_DOCUMENT_CONSTRAINTS.maxBulkDocuments)
    expect(normalized.acceptedUploadTypes).toEqual(FALLBACK_ACCEPTED_UPLOAD_TYPES)
    // Never renders as NaN wherever the limit is shown to the user.
    expect(formatUploadMegabytes(normalized.maxDocumentBytes)).toBe('20.00 MB')
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, '20' as unknown as number])(
    'rejects %j as a size limit',
    value => {
      expect(normalizeDocumentConstraints({ maxDocumentBytes: value }).maxDocumentBytes)
        .toBe(FALLBACK_DOCUMENT_CONSTRAINTS.maxDocumentBytes)
    })

  it('falls back when the accepted-type list is present but empty', () => {
    expect(normalizeDocumentConstraints({ acceptedUploadTypes: [] }).acceptedUploadTypes)
      .toEqual(FALLBACK_ACCEPTED_UPLOAD_TYPES)
  })
})
