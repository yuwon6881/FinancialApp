import { describe, expect, it } from 'vitest'
import {
  addScenarioItem,
  buildScenarioItem,
  clampCycles,
  emptyScenario,
  FORECAST_MAX_ITEMS,
  isScenarioChanged,
  parseOptionalAmount,
  parseScenarioDraft,
  removeScenarioItem,
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
    [{ label: 'x', date: '2026-12-10', amount: '0' }, 'Enter an amount above zero.'],
    [{ label: 'x', date: '2026-12-10', amount: 'abc' }, 'Enter an amount above zero.'],
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
})
