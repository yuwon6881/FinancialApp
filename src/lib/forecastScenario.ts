// The Forecast workspace's scenario is temporary by design: it lives in view state and an
// optional on-device draft, and is only ever sent to the read-only forecast endpoint. These pure
// helpers are the whole editing model, so the view hook stays a thin coordinator.

import type { ForecastBucket, ForecastScenario, ForecastScenarioItem } from '../types'
import { FORECAST_BUCKETS } from '../types'

export const FORECAST_MIN_CYCLES = 1
export const FORECAST_MAX_CYCLES = 12
export const FORECAST_DEFAULT_CYCLES = 4
export const FORECAST_MAX_ITEMS = 50
export const FORECAST_LABEL_MAX = 80

const DRAFT_KEY = 'financial-app:forecast-scenario:v1'

export const emptyScenario = (): ForecastScenario => ({
  cycles: FORECAST_DEFAULT_CYCLES,
  incomePerCycle: null,
  everydaySpendingPerCycle: null,
  items: [],
  skippedBills: [],
})

export interface ScenarioItemDraft {
  label: string
  date: string
  amount: string
  /** 'In' is extra income split like a salary; a bucket name is spending from that bucket. */
  target: 'In' | ForecastBucket
}

/** Returns the item to add, or the reason the draft cannot be added yet. */
export function buildScenarioItem(draft: ScenarioItemDraft, id: string): ForecastScenarioItem | string {
  const label = draft.label.trim()
  if (!label) return 'Give it a name.'
  if (label.length > FORECAST_LABEL_MAX) return `Keep the name under ${FORECAST_LABEL_MAX} characters.`
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return 'Pick a date.'
  const amount = Number(draft.amount)
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter an amount above zero.'
  const rounded = Math.round(amount * 100) / 100
  return draft.target === 'In'
    ? { id, label, date: draft.date, amount: rounded, bucket: null }
    : { id, label, date: draft.date, amount: -rounded, bucket: draft.target }
}

export function addScenarioItem(scenario: ForecastScenario, item: ForecastScenarioItem): ForecastScenario {
  if (scenario.items.length >= FORECAST_MAX_ITEMS) return scenario
  return { ...scenario, items: [...scenario.items, item] }
}

export function removeScenarioItem(scenario: ForecastScenario, id: string): ForecastScenario {
  return { ...scenario, items: scenario.items.filter(item => item.id !== id) }
}

export function toggleSkippedBill(scenario: ForecastScenario, billKey: string): ForecastScenario {
  const skipped = scenario.skippedBills.includes(billKey)
    ? scenario.skippedBills.filter(key => key !== billKey)
    : [...scenario.skippedBills, billKey]
  return { ...scenario, skippedBills: skipped }
}

/** Blank means "not included", never zero: the forecast reports the figure as unknown. */
export function parseOptionalAmount(value: string): number | null {
  if (value.trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null
}

export function clampCycles(value: number): number {
  if (!Number.isFinite(value)) return FORECAST_DEFAULT_CYCLES
  return Math.min(FORECAST_MAX_CYCLES, Math.max(FORECAST_MIN_CYCLES, Math.round(value)))
}

export function isScenarioChanged(scenario: ForecastScenario): boolean {
  return scenario.items.length > 0 || scenario.skippedBills.length > 0
}

function isScenarioItem(value: unknown): value is ForecastScenarioItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.label === 'string' && typeof item.date === 'string'
    && typeof item.amount === 'number' && Number.isFinite(item.amount)
    && (item.bucket === null || FORECAST_BUCKETS.includes(item.bucket as ForecastBucket))
}

const optionalAmount = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null

/** Reads a draft back defensively: anything unreadable falls back to an empty scenario. */
export function parseScenarioDraft(raw: string | null): ForecastScenario {
  if (!raw) return emptyScenario()
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    return {
      cycles: clampCycles(typeof value.cycles === 'number' ? value.cycles : FORECAST_DEFAULT_CYCLES),
      incomePerCycle: optionalAmount(value.incomePerCycle),
      everydaySpendingPerCycle: optionalAmount(value.everydaySpendingPerCycle),
      items: Array.isArray(value.items) ? value.items.filter(isScenarioItem).slice(0, FORECAST_MAX_ITEMS) : [],
      skippedBills: Array.isArray(value.skippedBills)
        ? value.skippedBills.filter((key): key is string => typeof key === 'string')
        : [],
    }
  } catch {
    return emptyScenario()
  }
}

/** The draft is a per-device convenience only; storage that throws simply keeps nothing. */
export function loadScenarioDraft(): ForecastScenario {
  try {
    return parseScenarioDraft(localStorage.getItem(DRAFT_KEY))
  } catch {
    return emptyScenario()
  }
}

export function saveScenarioDraft(scenario: ForecastScenario): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(scenario))
  } catch {
    // Private mode or a full quota: the workspace still works for this visit.
  }
}

export function clearScenarioDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Nothing stored, nothing to clear.
  }
}
