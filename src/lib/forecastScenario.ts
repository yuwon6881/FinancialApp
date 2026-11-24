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

/**
 * Every what-if the sheet can describe. A move is two linked lines — out of one bucket and into
 * another on the same day — so the server needs no new concept and the total never changes.
 */
export type ScenarioChangeKind = 'move' | 'spend' | 'add' | 'income'

export interface ScenarioChangeDraft {
  kind: ScenarioChangeKind
  label: string
  date: string
  amount: string
  /** The bucket spent from, added to, or (for a move) taken from. */
  bucket: ForecastBucket
  /** Where a move lands. */
  toBucket: ForecastBucket
}

const validateAmountAndDate = (date: string, raw: string): number | string => {
  if (!isDateOnly(date)) return 'Pick a date.'
  if (Number(raw) > FORECAST_MAX_AMOUNT) return 'Enter an amount of 100,000,000 or less.'
  return parseOptionalAmount(raw) || 'Enter an amount above zero.'
}

/** Returns the item to add, or the reason the draft cannot be added yet. */
export function buildScenarioItem(draft: ScenarioItemDraft, id: string): ForecastScenarioItem | string {
  const label = draft.label.trim()
  if (!label) return 'Give it a name.'
  if (label.length > FORECAST_LABEL_MAX) return `Keep the name under ${FORECAST_LABEL_MAX} characters.`
  const amount = validateAmountAndDate(draft.date, draft.amount)
  if (typeof amount === 'string') return amount
  return draft.target === 'In'
    ? { id, label, date: draft.date, amount, bucket: null }
    : { id, label, date: draft.date, amount: -amount, bucket: draft.target }
}

/** The lines one change adds, or the reason it cannot be added yet. A move names itself. */
export function buildScenarioChange(draft: ScenarioChangeDraft, newId: () => string): ForecastScenarioItem[] | string {
  if (draft.kind !== 'move') {
    const item = buildScenarioItem({
      label: draft.label, date: draft.date, amount: draft.amount,
      target: draft.kind === 'income' ? 'In' : draft.bucket,
    }, newId())
    if (typeof item === 'string' || draft.kind !== 'add') return typeof item === 'string' ? item : [item]
    return [{ ...item, amount: Math.abs(item.amount) }]
  }
  if (draft.bucket === draft.toBucket) return 'Choose two different categories.'
  const label = draft.label.trim() || `Move ${draft.bucket} to ${draft.toBucket}`
  if (label.length > FORECAST_LABEL_MAX) return `Keep the name under ${FORECAST_LABEL_MAX} characters.`
  const amount = validateAmountAndDate(draft.date, draft.amount)
  if (typeof amount === 'string') return amount
  const transferId = newId()
  return [
    { id: newId(), label, date: draft.date, amount: -amount, bucket: draft.bucket, transferId },
    { id: newId(), label, date: draft.date, amount, bucket: draft.toBucket, transferId },
  ]
}

export function addScenarioItem(scenario: ForecastScenario, item: ForecastScenarioItem): ForecastScenario {
  return addScenarioItems(scenario, [item])
}

/** Adds every line of one change or none of them, so a move never arrives half-applied. */
export function addScenarioItems(scenario: ForecastScenario, items: readonly ForecastScenarioItem[]): ForecastScenario {
  if (scenario.items.length + items.length > FORECAST_MAX_ITEMS) return scenario
  return { ...scenario, items: [...scenario.items, ...items] }
}

/** Removing either half of a move removes the whole move. */
export function removeScenarioItem(scenario: ForecastScenario, id: string): ForecastScenario {
  const transferId = scenario.items.find(item => item.id === id)?.transferId
  return { ...scenario, items: scenario.items.filter(item => item.id !== id && (!transferId || item.transferId !== transferId)) }
}

export interface ScenarioChangeRow {
  id: string
  label: string
  date: string
  /** For a move, the amount moved; otherwise the signed amount. */
  amount: number
  detail: string
  isMove: boolean
}

/** One row per change for the scenario list: the two halves of a move read as one. */
export function scenarioChangeRows(items: readonly ForecastScenarioItem[]): ScenarioChangeRow[] {
  const rows: ScenarioChangeRow[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (item.transferId) {
      if (seen.has(item.transferId)) continue
      seen.add(item.transferId)
      const pair = items.filter(other => other.transferId === item.transferId)
      const from = pair.find(other => other.amount < 0)
      const to = pair.find(other => other.amount > 0)
      if (from && to) {
        rows.push({ id: item.id, label: item.label, date: item.date, amount: to.amount, detail: `${from.bucket} → ${to.bucket}`, isMove: true })
        continue
      }
    }
    rows.push({
      id: item.id, label: item.label, date: item.date, amount: item.amount, isMove: false,
      detail: item.bucket === null ? 'Extra income' : item.amount > 0 ? `Into ${item.bucket}` : item.bucket,
    })
  }
  return rows
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
    && (item.transferId === undefined || (typeof item.transferId === 'string' && item.bucket !== null))
}

/** A stored move missing one half would silently create or destroy money, so it is dropped whole. */
function completeMoves(items: ForecastScenarioItem[]): ForecastScenarioItem[] {
  const halves = new Map<string, number>()
  for (const item of items) if (item.transferId) halves.set(item.transferId, (halves.get(item.transferId) ?? 0) + 1)
  return items.filter(item => item.transferId === undefined || halves.get(item.transferId) === 2)
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
      items: Array.isArray(value.items) ? completeMoves(value.items.filter(isScenarioItem).slice(0, FORECAST_MAX_ITEMS)) : [],
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
