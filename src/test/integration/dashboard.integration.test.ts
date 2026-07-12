import { describe, it, expect } from 'vitest'
import { fetchDashboard, selectPeriod, updateSettings } from '@/lib/api/financial'
import { addTransaction } from '@/lib/api/transactions'
import { invalidateCache } from '@/lib/api/client'
import { state } from '@/test/msw/backend'

describe('dashboard & cycle integration', () => {
  it('fetches the dashboard with deobfuscated stats and settings', async () => {
    const dash = await fetchDashboard()
    expect(typeof dash.stats.totalBalance).toBe('number')
    // targetStabilityFund comes across obfuscated and is deobfuscated to the seeded 10000.
    expect(dash.setting.targetStabilityFund).toBe(10000)
    expect(dash.cycleLabel).toContain('Jun')
  })

  it('recalculates the wallet balance after a new transaction', async () => {
    const before = await fetchDashboard()
    expect(before.stats.totalBalance).toBe(0)

    await addTransaction({
      date: '2026-06-15',
      description: 'Expense',
      category: 'Food',
      ledgerCategory: 'Essentials',
      amount: -125,
    })

    // addTransaction invalidates the client cache; fetch again to hit the backend.
    const after = await fetchDashboard()
    expect(after.stats.totalBalance).toBe(-125)
  })

  it('switches the active cycle via selectPeriod', async () => {
    await selectPeriod('Mar', 2025)
    expect(state.setting.selectedMonth).toBe('Mar')
    expect(state.setting.selectedYear).toBe(2025)

    invalidateCache()
    const dash = await fetchDashboard()
    expect(dash.setting.selectedMonth).toBe('Mar')
    expect(dash.setting.selectedYear).toBe(2025)
  })

  it('persists updated settings (obfuscating the stability fund target)', async () => {
    await updateSettings({
      targetStabilityFund: 5000,
      essentialsAlloc: 0.4,
      growthAlloc: 0.3,
      stabilityAlloc: 0.2,
      rewardsAlloc: 0.1,
      cycleDay: 15,
      currency: 'EUR',
    })

    invalidateCache()
    const dash = await fetchDashboard()
    expect(dash.setting.targetStabilityFund).toBe(5000)
    expect(dash.setting.currency).toBe('EUR')
    expect(dash.setting.cycleDay).toBe(15)
  })
})
