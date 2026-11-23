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
const FORECAST_MAX_AMOUNT = 100_000_000

const DRAFT_KEY = 'financial-app:forecast-scenario:v2:'
const draftKey = (account: string, currency: string) => DRAFT_KEY + JSON.stringify([account, currency])

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
})
const dateAtUtc = (date: string) => new Date(`${date}T00:00:00Z`)

export function formatForecastDate(date: string): string {
  return dateFormat.format(dateAtUtc(date))
}

export function formatForecastRange(start: string, end: string): string {
  return dateFormat.formatRange(dateAtUtc(start), dateAtUtc(end))
}

function isDateOnly(date: unknown): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = dateAtUtc(date)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

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
  if (!isDateOnly(draft.date)) return 'Pick a date.'
  const amount = parseOptionalAmount(draft.amount)
  if (Number(draft.amount) > FORECAST_MAX_AMOUNT) return 'Enter an amount of 100,000,000 or less.'
  if (!amount) return 'Enter an amount above zero.'
  return draft.target === 'In'
    ? { id, label, date: draft.date, amount, bucket: null }
    : { id, label, date: draft.date, amount: -amount, bucket: draft.target }
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
  return Number.isFinite(amount) && amount >= 0 && amount <= FORECAST_MAX_AMOUNT
    ? Math.round(amount * 100) / 100
    : null
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
  return typeof item.id === 'string' && typeof item.label === 'string' && isDateOnly(item.date)
    && typeof item.amount === 'number' && item.amount !== 0 && Math.abs(item.amount) <= FORECAST_MAX_AMOUNT
    && (item.bucket === null || FORECAST_BUCKETS.includes(item.bucket as ForecastBucket))
}

const optionalAmount = (value: unknown) =>
  typeof value === 'number' && value >= 0 && value <= FORECAST_MAX_AMOUNT ? value : null

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
export function loadScenarioDraft(account: string, currency: string): ForecastScenario {
  if (!account) return emptyScenario()
  try {
    return parseScenarioDraft(localStorage.getItem(draftKey(account, currency)))
  } catch {
    return emptyScenario()
  }
}

export function saveScenarioDraft(account: string, currency: string, scenario: ForecastScenario): void {
  if (!account) return
  try {
    localStorage.setItem(draftKey(account, currency), JSON.stringify(scenario))
  } catch {
    // Private mode or a full quota: the workspace still works for this visit.
  }
}

export function clearForecastDrafts(): void {
  const keys = Object.keys(localStorage).filter(key => key.startsWith(DRAFT_KEY))
  for (const key of [...keys, 'financial-app:forecast-scenario:v1']) {
    localStorage.removeItem(key)
  }
}
