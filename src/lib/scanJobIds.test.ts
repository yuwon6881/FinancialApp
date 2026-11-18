import { beforeEach, describe, expect, it } from 'vitest'
import {
  allScanJobIdsStorageKeys,
  isCurrentScanJobId,
  readStoredScanJobIds,
  scanJobIdsStorageKey,
} from './scanJobIds'

describe('scan job id storage', () => {
  beforeEach(() => localStorage.clear())

  it('accepts current API ids and rejects ids from the legacy scanner', () => {
    expect(isCurrentScanJobId('ocr-0123456789abcdef')).toBe(true)
    expect(isCurrentScanJobId('faca36d2f4d9992eb')).toBe(false)
    expect(isCurrentScanJobId(null)).toBe(false)
  })

  it('removes legacy ids before the polling hook can request them', () => {
    const key = scanJobIdsStorageKey('receipt_scan_job_ids', 'sam')
    localStorage.setItem(key, JSON.stringify(['faca36d2f4d9992eb', 'ocr-0123456789abcdef']))

    expect(readStoredScanJobIds('receipt_scan_job_ids', 'sam')).toEqual(['ocr-0123456789abcdef'])
    expect(JSON.parse(localStorage.getItem(key) || '[]')).toEqual(['ocr-0123456789abcdef'])
  })

  it('keeps each account on the device to its own tracked scans', () => {
    localStorage.setItem(scanJobIdsStorageKey('receipt_scan_job_ids', 'sam'), JSON.stringify(['ocr-sam']))

    expect(readStoredScanJobIds('receipt_scan_job_ids', 'alex')).toEqual([])
    expect(readStoredScanJobIds('receipt_scan_job_ids', 'Sam')).toEqual(['ocr-sam'])
  })

  it('lets the first account to sign in adopt the pre-upgrade shared list exactly once', () => {
    localStorage.setItem('receipt_scan_job_ids', JSON.stringify(['ocr-inflight']))

    expect(readStoredScanJobIds('receipt_scan_job_ids', 'sam')).toEqual(['ocr-inflight'])
    expect(localStorage.getItem('receipt_scan_job_ids')).toBeNull()
    expect(readStoredScanJobIds('receipt_scan_job_ids', 'alex')).toEqual([])
  })

  it('lists every account-scoped and legacy key for the local-data wipe', () => {
    localStorage.setItem(scanJobIdsStorageKey('investment_scan_job_ids', 'sam'), '[]')
    localStorage.setItem('unrelated', '1')

    const keys = allScanJobIdsStorageKeys()
    expect(keys).toContain('investment_scan_job_ids:sam')
    expect(keys).toContain('receipt_scan_job_ids')
    expect(keys).not.toContain('unrelated')
  })
})
