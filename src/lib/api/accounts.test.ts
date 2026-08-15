import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './client'
import {
  addLedgerAccount,
  deleteLedgerAccount,
  fetchLedgerAccounts,
  reconcileLedgerAccounts,
  updateLedgerAccount,
} from './accounts'

describe('accounts API contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetchLedgerAccounts parses and deobfuscates accounts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [
        {
          id: 'acct-1',
          name: 'Main Bank',
          bucket: 'Essentials',
          kind: 'Bank',
          isArchived: false,
          remaining: '100',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })
    vi.stubGlobal('fetch', fetchMock)

    const accounts = await fetchLedgerAccounts()
    expect(accounts).toHaveLength(1)
    expect(accounts[0].id).toBe('acct-1')
    expect(accounts[0].name).toBe('Main Bank')
    expect(accounts[0].remaining).toBe(100)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/accounts')
  })

  it('addLedgerAccount sends obfuscated opening amount and normalized interest settings', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({
        id: 'acct-new',
        name: 'New Savings',
        bucket: 'Stability',
        kind: 'Bank',
        isArchived: false,
        interestEnabled: true,
        interestRatePercent: 4.5,
        interestFrequency: 'Monthly',
        remaining: '500',
        createdAt: '2026-08-15T00:00:00.000Z',
        updatedAt: '2026-08-15T00:00:00.000Z',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const account = await addLedgerAccount({
      name: 'New Savings',
      bucket: 'Stability',
      kind: 'Bank',
      openingAmount: 500,
      interestEnabled: true,
      interestRatePercent: 4.5,
      interestFrequency: 'Monthly',
    })

    expect(account.id).toBe('acct-new')
    expect(account.remaining).toBe(500)
    const requestOptions = fetchMock.mock.calls[0][1]
    expect(requestOptions.method).toBe('POST')
    const body = JSON.parse(String(requestOptions.body))
    expect(body.name).toBe('New Savings')
    expect(body.bucket).toBe('Stability')
    expect(body.interestEnabled).toBe(true)
    expect(body.interestRatePercent).toBe(4.5)
  })

  it('updateLedgerAccount encodes url and body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        id: 'acct/1',
        name: 'Renamed',
        bucket: 'Growth',
        kind: 'Other',
        isArchived: true,
        remaining: '0',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-15T00:00:00.000Z',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const updated = await updateLedgerAccount('acct/1', {
      name: 'Renamed',
      bucket: 'Growth',
      kind: 'Other',
      isArchived: true,
    })

    expect(updated.name).toBe('Renamed')
    expect(String(fetchMock.mock.calls[0][0])).toContain('/accounts/acct%2F1')
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
  })

  it('deleteLedgerAccount issues DELETE request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => null },
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    await deleteLedgerAccount('acct-del')
    expect(String(fetchMock.mock.calls[0][0])).toContain('/accounts/acct-del')
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
  })

  it('reconcileLedgerAccounts handles preview/commit and returns created transactions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        accounts: [
          {
            id: 'acct-1',
            name: 'Bank',
            bucket: 'Essentials',
            kind: 'Bank',
            isArchived: false,
            remaining: '60',
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-15T00:00:00.000Z',
          },
          {
            id: 'acct-2',
            name: 'Cash',
            bucket: 'Essentials',
            kind: 'Cash',
            isArchived: false,
            remaining: '40',
            createdAt: '2026-08-15T00:00:00.000Z',
            updatedAt: '2026-08-15T00:00:00.000Z',
          },
        ],
        transactions: [
          {
            id: 'reconcile-op-1-move-0',
            date: '2026-08-15T00:00:00.000Z',
            description: 'Move between accounts',
            category: 'Transfer',
            ledgerCategory: 'AccountMove',
            amount: '40',
            accountId: 'acct-1',
            counterAccountId: 'acct-2',
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await reconcileLedgerAccounts({
      operationId: 'op-1',
      bucket: 'Essentials',
      expectedBucketTotal: 100,
      adjustmentAccountId: null,
      targets: [
        { id: 'acct-1', name: 'Bank', kind: 'Bank', isArchived: false, expectedCurrent: 100, target: 60 },
        { id: 'acct-2', name: 'Cash', kind: 'Cash', isArchived: false, expectedCurrent: 0, target: 40 },
      ],
    })

    expect(result.accounts).toHaveLength(2)
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].amount).toBe(40)
    expect(result.transactions[0].ledgerCategory).toBe('AccountMove')
  })

  it('maps 409 conflict errors onto ApiError', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'The bucket changed while this setup was open.' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      reconcileLedgerAccounts({
        operationId: 'op-stale',
        bucket: 'Essentials',
        expectedBucketTotal: 50,
        targets: [{ id: 'acct-1', name: 'Bank', kind: 'Bank', isArchived: false, expectedCurrent: 50, target: 60 }],
      }),
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(409)
      expect(apiErr.message).toBe('The bucket changed while this setup was open.')
      return true
    })
  })
})
