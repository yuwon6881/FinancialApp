import { describe, it, expect } from 'vitest'
import { buildIncomeSplitRows, projectIncomeSplitRows } from './incomeSplitProjection'
import { computeIncomeLedgerCategory } from './incomeSplit'

const allocations = {
  essentialsAlloc: 0.5,
  growthAlloc: 0.2,
  stabilityAlloc: 0.1,
  rewardsAlloc: 0.2,
}

const income = {
  id: 'tx-1',
  date: '2026-08-07',
  postedAt: '2026-08-07T09:00:00.000Z',
  description: 'Salary',
  ledgerCategory: 'Income',
  amount: 1000,
}

describe('which rows are generated', () => {
  const idsFor = (ledgerCategory: string, allocs: typeof allocations | undefined = allocations) =>
    buildIncomeSplitRows({ ...income, ledgerCategory }, allocs).map(row => row.id)

  it('reads the percentages an IncomeSplit row already carries, without needing settings', () => {
    expect(buildIncomeSplitRows(
      { ...income, ledgerCategory: 'IncomeSplit:60.0000,20.0000,0.0000,20.0000' },
      undefined,
    ).map(row => row.amount)).toEqual([600, 200, 200])
  })

  it('falls back to the stored plan for a plain Income row', () => {
    expect(buildIncomeSplitRows(income, allocations).map(row => row.amount)).toEqual([500, 200, 100, 200])
  })

  it('generates nothing for another bucket, a malformed spec, or income with no plan loaded', () => {
    expect(idsFor('Essentials')).toEqual([])
    expect(idsFor('IncomeSplit:50,50')).toEqual([])
    expect(buildIncomeSplitRows(income, undefined)).toEqual([])
  })
})

describe('buildIncomeSplitRows', () => {
  it('mirrors the ids, descriptions and categories the server generates', () => {
    const rows = buildIncomeSplitRows(income, allocations)

    expect(rows.map(row => row.id)).toEqual([
      'tx-1-split-Essentials',
      'tx-1-split-Growth',
      'tx-1-split-Stability',
      'tx-1-split-Rewards',
    ])
    expect(rows[0]).toMatchObject({
      description: '[Split: Essentials] Salary',
      category: 'Transfer',
      ledgerCategory: 'Transfer:Income->Essentials',
      amount: 500,
      date: '2026-08-07',
      postedAt: '2026-08-07T09:00:00.000Z',
    })
  })

  it('allocates by largest remainder so the rows sum to the salary exactly', () => {
    const rows = buildIncomeSplitRows(
      { ...income, amount: 1000.01, ledgerCategory: 'IncomeSplit:33.3333,33.3333,0.0000,33.3334' },
      undefined,
    )

    const total = rows.reduce((sum, row) => sum + row.amount, 0)
    expect(Math.round(total * 100)).toBe(100001)
  })

  it('follows an accepted emergency-fund top-up, which the form has already encoded', () => {
    // Ticking the offer routes extra money to Stability out of the other three, so the
    // projected rows must come from the encoded split rather than the plain plan.
    const ledgerCategory = computeIncomeLedgerCategory({
      amount: 4000,
      essentialsAlloc: 0.5,
      growthAlloc: 0.2,
      stabilityAlloc: 0.1,
      rewardsAlloc: 0.2,
      stabilityBalance: 1600,
      stabilityTarget: 5000,
      stabilityOverflowRedirect: 'Growth 100%',
      recoveryTopUp: 658,
    })
    expect(ledgerCategory.startsWith('IncomeSplit:')).toBe(true)

    const rows = buildIncomeSplitRows({ ...income, amount: 4000, ledgerCategory }, allocations)

    // 10% of 4000 plus the accepted 658, and the other buckets give it up pro rata.
    expect(rows.find(row => row.id === 'tx-1-split-Stability')?.amount).toBe(1058)
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(4000)
  })

  it('omits a bucket that receives nothing, and every row for a non-income transaction', () => {
    const capped = buildIncomeSplitRows(
      { ...income, ledgerCategory: 'IncomeSplit:60.0000,20.0000,0.0000,20.0000' },
      undefined,
    )
    expect(capped.map(row => row.id)).not.toContain('tx-1-split-Stability')

    expect(buildIncomeSplitRows({ ...income, amount: -40, ledgerCategory: 'Essentials' }, allocations)).toEqual([])
  })

  it('assigns splitAccountIds to generated split child rows per bucket', () => {
    const rows = buildIncomeSplitRows(
      {
        ...income,
        splitAccountIds: {
          Essentials: 'acc-essentials-custom',
          Growth: 'acc-growth-custom',
          Stability: 'acc-stability-custom',
          Rewards: 'acc-rewards-custom',
        },
      },
      allocations,
    )

    expect(rows.find(r => r.id === 'tx-1-split-Essentials')?.accountId).toBe('acc-essentials-custom')
    expect(rows.find(r => r.id === 'tx-1-split-Growth')?.accountId).toBe('acc-growth-custom')
    expect(rows.find(r => r.id === 'tx-1-split-Stability')?.accountId).toBe('acc-stability-custom')
    expect(rows.find(r => r.id === 'tx-1-split-Rewards')?.accountId).toBe('acc-rewards-custom')
  })
})

describe('re-deriving children keeps their account placement', () => {
  // splitAccountIds only ever travels on a create/update request; the list DTO does not return it.
  // Re-deriving children for a saved row therefore has to fall back to the account each child
  // already had, as the server does — a move rewrites only the child's date. Dropping the account
  // made every receiving account's balance dip until the next refresh put it back.
  const parent = { ...income, ledgerCategory: 'IncomeSplit:50,20,10,20', amount: 1000 }
  const existingChildren = [
    { id: 'tx-1-split-Essentials', accountId: 'acct-essentials' },
    { id: 'tx-1-split-Growth', accountId: 'acct-growth' },
    { id: 'tx-1-split-Stability', accountId: 'acct-stability' },
    { id: 'tx-1-split-Rewards', accountId: 'acct-rewards' },
  ]

  it('carries each existing child\x27s account onto the rebuilt row', () => {
    const projected = projectIncomeSplitRows(
      [parent, ...existingChildren] as never[],
      'tx-1',
      allocations,
      {},
    ) as unknown as { id: string; accountId?: string }[]

    expect(projected.find(row => row.id === 'tx-1-split-Essentials')?.accountId).toBe('acct-essentials')
    expect(projected.find(row => row.id === 'tx-1-split-Growth')?.accountId).toBe('acct-growth')
    expect(projected.find(row => row.id === 'tx-1-split-Stability')?.accountId).toBe('acct-stability')
    expect(projected.find(row => row.id === 'tx-1-split-Rewards')?.accountId).toBe('acct-rewards')
  })

  it('prefers an explicit request placement over the previous one', () => {
    const projected = projectIncomeSplitRows(
      [{ ...parent, splitAccountIds: { Growth: 'acct-growth-new' } }, ...existingChildren] as never[],
      'tx-1',
      allocations,
      {},
    ) as unknown as { id: string; accountId?: string }[]

    expect(projected.find(row => row.id === 'tx-1-split-Growth')?.accountId).toBe('acct-growth-new')
    expect(projected.find(row => row.id === 'tx-1-split-Rewards')?.accountId).toBe('acct-rewards')
  })
})
