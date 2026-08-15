import { afterEach, describe, expect, it, vi } from 'vitest'
import { fundSavingsGoalsForCycle } from './savingsGoals'

describe('savings-goal API contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends the selected funding bucket to the authoritative fund action', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        goals: [],
        totalGranted: 0,
        freeToSpend: 125,
        rewardsFreeToSpend: 125,
        essentialsFreeToSpend: 0,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fundSavingsGoalsForCycle('Essentials')

    expect(String(fetchMock.mock.calls[0][0])).toContain('/savings-goals/fund')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ fundingBucket: 'Essentials' })
  })

  it('keeps Rewards as the compatibility default when callers omit the bucket', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ goals: [], totalGranted: 0, freeToSpend: 0 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fundSavingsGoalsForCycle()

    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ fundingBucket: 'Rewards' })
  })
})
