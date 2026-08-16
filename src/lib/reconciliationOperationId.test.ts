import { describe, expect, it } from 'vitest'
import { sanitizeReconciliationOperationId } from './reconciliationOperationId'

describe('sanitizeReconciliationOperationId', () => {
  it('uses only server-safe characters and the shared 60-character limit', () => {
    const value = sanitizeReconciliationOperationId('a'.repeat(80) + '! undo')
    expect(value).toBe('a'.repeat(60))
  })

  it('falls back when the operation contains no safe characters', () => {
    expect(sanitizeReconciliationOperationId('!!!')).toBe('operation')
  })
})
