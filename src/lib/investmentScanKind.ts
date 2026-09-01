import type { InvestmentActivityScanResult } from './api'

/**
 * Which of the two investment forms a scanned image belongs to. The scan endpoint returns one
 * union covering both, and three places used to re-list the cash types inline — a new type added
 * to only some of them would have routed the user to a form that then discards the draft.
 */
export const CASH_MOVEMENT_SCAN_TYPES = ['Deposit', 'Withdrawal', 'Conversion'] as const

type ScanType = InvestmentActivityScanResult['type']

export function isCashMovementScan(type: ScanType): boolean {
  return type != null && (CASH_MOVEMENT_SCAN_TYPES as readonly string[]).includes(type)
}

/** A trade, dividend or fee/tax: anything the activity form owns. Unreadable types are neither. */
export function isActivityScan(type: ScanType): boolean {
  return type != null && !isCashMovementScan(type)
}
