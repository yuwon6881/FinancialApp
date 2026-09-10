import { beforeEach, describe, expect, it } from 'vitest'
import { isCurrentScanJobId, readStoredScanJobIds } from './scanJobIds'

describe('scan job id storage', () => {
  beforeEach(() => localStorage.clear())

  it('accepts current API ids and rejects ids from the legacy scanner', () => {
    expect(isCurrentScanJobId('ocr-0123456789abcdef')).toBe(true)
    expect(isCurrentScanJobId('faca36d2f4d9992eb')).toBe(false)
    expect(isCurrentScanJobId(null)).toBe(false)
  })

  it('removes legacy ids before the polling hook can request them', () => {
    localStorage.setItem('receipt_scan_job_ids', JSON.stringify([
      'faca36d2f4d9992eb',
      'ocr-0123456789abcdef',
    ]))

    expect(readStoredScanJobIds('receipt_scan_job_ids')).toEqual(['ocr-0123456789abcdef'])
    expect(JSON.parse(localStorage.getItem('receipt_scan_job_ids') || '[]')).toEqual(['ocr-0123456789abcdef'])
  })
})
