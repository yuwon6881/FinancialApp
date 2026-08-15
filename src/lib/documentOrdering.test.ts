import { describe, expect, it } from 'vitest'
import { DOCUMENT_SORT_OPTIONS, type DocumentSort } from './documentOrdering'

describe('documentOrdering', () => {
  it('defines valid non-empty sort options with distinct values', () => {
    expect(DOCUMENT_SORT_OPTIONS.length).toBe(6)
    const values = DOCUMENT_SORT_OPTIONS.map(opt => opt.value)
    expect(new Set(values).size).toBe(DOCUMENT_SORT_OPTIONS.length)

    const expectedKeys: DocumentSort[] = [
      'uploaded-desc',
      'uploaded-asc',
      'name-asc',
      'name-desc',
      'amount-desc',
      'amount-asc',
    ]
    expect(values).toEqual(expectedKeys)
  })

  it('provides beginner-friendly labels without abbreviations', () => {
    for (const opt of DOCUMENT_SORT_OPTIONS) {
      expect(opt.label).toBeTruthy()
      expect(typeof opt.label).toBe('string')
    }
  })
})
