import { describe, expect, it } from 'vitest'
import type { LedgerAccount } from '../types'
import { buildSingleAccountCorrection } from './accountBalanceCorrection'

const makeAccount = (partial: Partial<LedgerAccount>): LedgerAccount => ({
  id: 'acc-1',
  name: 'Everyday Bank',
  bucket: 'Essentials',
  kind: 'Bank',
  remaining: 1000,
  isArchived: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...partial,
})

describe('buildSingleAccountCorrection', () => {
  it('returns null when balance change is within epsilon', () => {
    const acc = makeAccount({ remaining: 1000 })
    const result = buildSingleAccountCorrection({
      account: acc,
      bucketAccounts: [acc],
      nextBalance: 1000.002,
    })
    expect(result).toBeNull()
  })

  it('builds a whole-bucket reconcile payload targeting all accounts in the bucket', () => {
    const acc1 = makeAccount({ id: 'acc-1', name: 'Primary Checking', remaining: 1500 })
    const acc2 = makeAccount({ id: 'acc-2', name: 'Petty Cash', kind: 'Cash', remaining: 200 })
    const acc3 = makeAccount({ id: 'acc-3', name: 'Old Account', isArchived: true, remaining: 50 })

    const result = buildSingleAccountCorrection({
      account: acc1,
      bucketAccounts: [acc1, acc2, acc3],
      nextBalance: 2000,
      nextName: 'Renamed Checking',
      nextKind: 'EWallet',
    })

    expect(result).not.toBeNull()
    expect(result!.bucket).toBe('Essentials')
    expect(result!.expectedBucketTotal).toBe(1750)
    expect(result).not.toHaveProperty('adjustmentAccountId')
    expect(result!.operationId).toMatch(/^balance-acc-1-\d+$/)
    expect(result!.targets).toHaveLength(3)

    const target1 = result!.targets.find(t => t.id === 'acc-1')
    expect(target1).toEqual({
      id: 'acc-1',
      name: 'Renamed Checking',
      bucket: 'Essentials',
      kind: 'EWallet',
      isArchived: false,
      expectedName: 'Primary Checking',
      expectedKind: 'Bank',
      expectedIsArchived: false,
      expectedCurrent: 1500,
      target: 2000,
    })

    const target2 = result!.targets.find(t => t.id === 'acc-2')
    expect(target2).toEqual({
      id: 'acc-2',
      name: 'Petty Cash',
      bucket: 'Essentials',
      kind: 'Cash',
      isArchived: false,
      expectedName: 'Petty Cash',
      expectedKind: 'Cash',
      expectedIsArchived: false,
      expectedCurrent: 200,
      target: 200,
    })

    const target3 = result!.targets.find(t => t.id === 'acc-3')
    expect(target3).toEqual({
      id: 'acc-3',
      name: 'Old Account',
      bucket: 'Essentials',
      kind: 'Bank',
      isArchived: true,
      expectedName: 'Old Account',
      expectedKind: 'Bank',
      expectedIsArchived: true,
      expectedCurrent: 50,
      target: 50,
    })
  })

  it('keeps operationId <= 80 chars with valid characters', () => {
    const acc = makeAccount({ id: 'very-long-custom-account-identifier-with-special@characters#123' })
    const result = buildSingleAccountCorrection({
      account: acc,
      bucketAccounts: [acc],
      nextBalance: 500,
    })
    expect(result).not.toBeNull()
    expect(result!.operationId.length).toBeLessThanOrEqual(80)
    expect(result!.operationId).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('includes edited account even if not present in bucketAccounts list', () => {
    const acc1 = makeAccount({ id: 'acc-1', remaining: 300 })
    const acc2 = makeAccount({ id: 'acc-2', remaining: 700 })

    const result = buildSingleAccountCorrection({
      account: acc1,
      bucketAccounts: [acc2],
      nextBalance: 400,
    })

    expect(result).not.toBeNull()
    expect(result!.targets).toHaveLength(2)
    expect(result!.expectedBucketTotal).toBe(1000)
    expect(result!.targets.map(t => t.id)).toEqual(['acc-2', 'acc-1'])
  })
})
