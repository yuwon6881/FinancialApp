import { describe, expect, it } from 'vitest'
import type { ForecastScenarioItem } from '../types'
import {
  addScenarioItem,
  addScenarioItems,
  buildScenarioChange,
  buildScenarioItem,
  clampCycles,
  emptyScenario,
  FORECAST_MAX_ITEMS,
  hasScenarioAdjustments,
  hasWhatIfChanges,
  isScenarioChanged,
  loadScenarioDraft,
  parseOptionalAmount,
  parseScenarioDraft,
  removeScenarioItem,
  resetScenarioAdjustments,
  resetWhatIfs,
  saveScenarioDraft,
  scenarioChangeRows,
  toggleSkippedBill,
} from './forecastScenario'

describe('buildScenarioItem', () => {
  it('turns spending into a negative amount from the chosen bucket', () => {
    expect(buildScenarioItem({ label: ' Tooth crown ', date: '2026-12-10', amount: '1800', target: 'Essentials' }, 'a'))
      .toEqual({ id: 'a', label: 'Tooth crown', date: '2026-12-10', amount: -1800, bucket: 'Essentials' })
  })

  it('keeps extra income positive and unassigned so it is split like a salary', () => {
    expect(buildScenarioItem({ label: 'Rebate', date: '2027-01-05', amount: '915.005', target: 'In' }, 'b'))
      .toEqual({ id: 'b', label: 'Rebate', date: '2027-01-05', amount: 915.01, bucket: null })
  })

  it.each([
    [{ label: '', date: '2026-12-10', amount: '10' }, 'Give it a name.'],
    [{ label: 'x', date: '', amount: '10' }, 'Pick a date.'],
    [{ label: 'x', date: '2026-02-30', amount: '10' }, 'Pick a date.'],
    [{ label: 'x', date: '2026-12-10', amount: '0' }, 'Enter an amount above zero.'],
    [{ label: 'x', date: '2026-12-10', amount: 'abc' }, 'Enter an amount above zero.'],
    [{ label: 'x', date: '2026-12-10', amount: '0.001' }, 'Enter an amount above zero.'],
    [{ label: 'x', date: '2026-12-10', amount: '100000001' }, 'Enter an amount of 100,000,000 or less.'],
  ])('explains why %o cannot be added', (draft, message) => {
    expect(buildScenarioItem({ ...draft, target: 'Essentials' }, 'c')).toBe(message)
  })
})

describe('scenario edits', () => {
  const item = { id: 'a', label: 'Crown', date: '2026-12-10', amount: -1800, bucket: 'Essentials' as const }

  it('adds and removes what-if items without touching the rest', () => {
    const added = addScenarioItem(emptyScenario(), item)
    expect(added.items).toEqual([item])
    expect(isScenarioChanged(added)).toBe(true)
    expect(removeScenarioItem(added, 'a').items).toEqual([])
  })

  it('stops adding at the item limit', () => {
    let scenario = emptyScenario()
    for (let index = 0; index < FORECAST_MAX_ITEMS + 3; index++) scenario = addScenarioItem(scenario, { ...item, id: String(index) })
    expect(scenario.items).toHaveLength(FORECAST_MAX_ITEMS)
  })

  it('toggles a skipped bill on and off', () => {
    const skipped = toggleSkippedBill(emptyScenario(), 'gym:2026-12-05')
    expect(skipped.skippedBills).toEqual(['gym:2026-12-05'])
    expect(toggleSkippedBill(skipped, 'gym:2026-12-05').skippedBills).toEqual([])
  })
})

describe('amount and cycle inputs', () => {
  it('treats a blank amount as not included rather than zero', () => {
    expect(parseOptionalAmount('')).toBeNull()
    expect(parseOptionalAmount('-5')).toBeNull()
    expect(parseOptionalAmount('0')).toBe(0)
    expect(parseOptionalAmount('4800.456')).toBe(4800.46)
    expect(parseOptionalAmount('4000+800')).toBe(4800)
    expect(parseOptionalAmount('12.5*3')).toBe(37.5)
    expect(parseOptionalAmount('12abc')).toBeNull()
  })

  it('keeps the horizon between 1 and 12 cycles', () => {
    expect(clampCycles(0)).toBe(1)
    expect(clampCycles(30)).toBe(12)
    expect(clampCycles(Number.NaN)).toBe(4)
  })
})

describe('parseScenarioDraft', () => {
  it('falls back to an empty scenario for missing or broken drafts', () => {
    expect(parseScenarioDraft(null)).toEqual(emptyScenario())
    expect(parseScenarioDraft('{not json')).toEqual(emptyScenario())
  })

  it('keeps valid parts and drops malformed items', () => {
    const draft = JSON.stringify({
      cycles: 6,
      incomePerCycle: 4800,
      everydaySpendingPerCycle: 'lots',
      items: [{ id: 'a', label: 'Crown', date: '2026-12-10', amount: -1800, bucket: 'Essentials' }, { id: 'b', bucket: 'Savings' }],
      skippedBills: ['gym:2026-12-05', 4],
    })
    expect(parseScenarioDraft(draft)).toEqual({
      cycles: 6,
      incomePerCycle: 4800,
      everydaySpendingPerCycle: null,
      items: [{ id: 'a', label: 'Crown', date: '2026-12-10', amount: -1800, bucket: 'Essentials' }],
      skippedBills: ['gym:2026-12-05'],
    })
  })

  it('only restores an on-device draft for the same account and currency', () => {
    const draft = { ...emptyScenario(), incomePerCycle: 4800 }
    saveScenarioDraft('alex', 'MYR', draft)

    expect(loadScenarioDraft('alex', 'MYR')).toEqual(draft)
    expect(loadScenarioDraft('other', 'MYR')).toEqual(emptyScenario())
    expect(loadScenarioDraft('alex', 'USD')).toEqual(emptyScenario())
    localStorage.clear()
  })
})

describe('moving money between buckets', () => {
  const ids = () => { let next = 0; return () => `id-${++next}` }
  const move = { kind: 'move' as const, label: '', date: '2026-12-28', amount: '1000', bucket: 'Rewards' as const, toBucket: 'Essentials' as const }

  it('adds two linked lines that leave the total unchanged and names itself', () => {
    const items = buildScenarioChange(move, ids())
    expect(items).toEqual([
      { id: 'id-2', label: 'Move Rewards to Essentials', date: '2026-12-28', amount: -1000, bucket: 'Rewards', transferId: 'id-1' },
      { id: 'id-3', label: 'Move Rewards to Essentials', date: '2026-12-28', amount: 1000, bucket: 'Essentials', transferId: 'id-1' },
    ])
    expect(buildScenarioChange({ ...move, toBucket: 'Rewards' }, ids())).toBe('Choose two different categories.')
  })

  it('adds money straight into one bucket without splitting it', () => {
    expect(buildScenarioChange({ ...move, kind: 'add', label: 'Gift' }, ids()))
      .toEqual([{ id: 'id-1', label: 'Gift', date: '2026-12-28', amount: 1000, bucket: 'Rewards' }])
  })

  it('shows a move as one row and removes both halves together', () => {
    const items = buildScenarioChange(move, ids()) as ForecastScenarioItem[]
    const scenario = addScenarioItems(emptyScenario(), items)
    expect(scenarioChangeRows(scenario.items)).toEqual([
      { id: 'id-2', label: 'Move Rewards to Essentials', date: '2026-12-28', amount: 1000, detail: 'Rewards → Essentials', isMove: true },
    ])
    expect(removeScenarioItem(scenario, 'id-3').items).toEqual([])
  })

  it('never adds half a move when only one line fits, and drops a stored half', () => {
    const full = { ...emptyScenario(), items: Array.from({ length: 49 }, (_, index) =>
      ({ id: `x${index}`, label: 'x', date: '2026-12-10', amount: -1, bucket: 'Essentials' as const })) }
    expect(addScenarioItems(full, buildScenarioChange(move, ids()) as ForecastScenarioItem[]).items).toHaveLength(49)
    const [half] = buildScenarioChange(move, ids()) as ForecastScenarioItem[]
    expect(parseScenarioDraft(JSON.stringify({ ...emptyScenario(), items: [half] })).items).toEqual([])
  })

  it('resets what-ifs and cycle adjustments independently', () => {
    const whatIf = { id: 'w1', label: 'Crown', date: '2026-12-10', amount: -1800, bucket: 'Essentials' as const }
    const adjustItems = buildScenarioChange(move, ids()) as ForecastScenarioItem[]
    let scenario = addScenarioItems(emptyScenario(), [whatIf], 'what-if')
    scenario = toggleSkippedBill(scenario, 'gym:2026-12-05')
    scenario = addScenarioItems(scenario, adjustItems, 'adjust')

    expect(hasWhatIfChanges(scenario)).toBe(true)
    expect(hasScenarioAdjustments(scenario)).toBe(true)
    expect(scenarioChangeRows(scenario.items).find(row => row.isMove)?.isAdjustment).toBe(true)

    const afterWhatIfReset = resetWhatIfs(scenario)
    expect(hasWhatIfChanges(afterWhatIfReset)).toBe(false)
    expect(hasScenarioAdjustments(afterWhatIfReset)).toBe(true)
    expect(afterWhatIfReset.skippedBills).toEqual([])
    expect(afterWhatIfReset.items.map(item => item.id)).toEqual(['id-2', 'id-3'])

    const afterAdjustReset = resetScenarioAdjustments(scenario)
    expect(hasWhatIfChanges(afterAdjustReset)).toBe(true)
    expect(hasScenarioAdjustments(afterAdjustReset)).toBe(false)
    expect(afterAdjustReset.items).toEqual([whatIf])
    expect(afterAdjustReset.skippedBills).toEqual(['gym:2026-12-05'])
  })
})
