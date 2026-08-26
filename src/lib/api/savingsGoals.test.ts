import { afterEach, describe, expect, it, vi } from 'vitest'
import { fundSavingsGoalsForCycle, undoSavingsGoalsCycleFunding } from './savingsGoals'

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
        actionId: 'fund-action-1',
        goals: [],
        totalGranted: 0,
        freeToSpend: 125,
        rewardsFreeToSpend: 125,
        essentialsFreeToSpend: 0,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fundSavingsGoalsForCycle('Essentials')

    expect(String(fetchMock.mock.calls[0][0])).toContain('/savings-goals/fund')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ fundingBucket: 'Essentials' })
    expect(result.actionId).toBe('fund-action-1')
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

  it('uses the server rollback route for a funding action', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ actionId: 'fund/action', goals: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await undoSavingsGoalsCycleFunding('fund/action')

    expect(String(fetchMock.mock.calls[0][0])).toContain('/savings-goals/fund/fund%2Faction/undo')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  })
})
