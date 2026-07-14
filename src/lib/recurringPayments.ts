import type { RecurringFrequency } from '../types'

export function normalizeRecurringFrequency(value: unknown): RecurringFrequency {
  return value === 'Annually' ? 'Annually' : 'Monthly'
}
