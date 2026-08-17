import type { RecurringPayment } from '../types'
import { hasBillingEnded } from './recurringPayments'

export interface AccountBillSummary {
  payment: RecurringPayment
  monthlyEquivalent: number
  nextDueDate: string | null
}

export interface AccountBillRoster {
  accountId: string
  active: AccountBillSummary[]
  paused: AccountBillSummary[]
  monthlyTotal: number
  autoDeductCount: number
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Formats an ISO date string (YYYY-MM-DD) into a concise plain-language date like "28 Aug".
 */
export function formatBillDueDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day || month < 1 || month > 12) return null
  return `${day} ${SHORT_MONTHS[month - 1]}`
}

/** How near a due date has to be before the roster marks it as needing attention. */
export const BILL_DUE_SOON_DAYS = 7

/**
 * Whether a bill's next due date is near enough to be worth the needs-attention colour.
 *
 * Compared date-only, in local time, so a bill due today counts and one that has already slipped
 * past still counts -- an overdue bill needs attention more than a nearby one, not less. Takes the
 * reference day explicitly so the rule is testable without freezing the clock.
 */
export function isBillDueSoon(
  dateStr: string | null | undefined,
  today: Date = new Date(),
): boolean {
  if (!dateStr) return false
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return false
  const due = new Date(year, month - 1, day)
  const reference = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((due.getTime() - reference.getTime()) / 86_400_000)
  return days <= BILL_DUE_SOON_DAYS
}

export function createEmptyAccountBillRoster(accountId: string): AccountBillRoster {
  return {
    accountId,
    active: [],
    paused: [],
    monthlyTotal: 0,
    autoDeductCount: 0,
  }
}

function compareBillSummaries(left: AccountBillSummary, right: AccountBillSummary): number {
  if (left.nextDueDate && right.nextDueDate) {
    const cmp = left.nextDueDate.localeCompare(right.nextDueDate)
    if (cmp !== 0) return cmp
  } else if (left.nextDueDate && !right.nextDueDate) {
    return -1
  } else if (!left.nextDueDate && right.nextDueDate) {
    return 1
  }
  return left.payment.name.localeCompare(right.payment.name, undefined, { sensitivity: 'base' })
}

/**
 * Builds account bill rosters indexed by accountId in a single O(N) pass.
 * Normalizes annual frequencies to their monthly equivalent (amount / 12),
 * partitions bills into active vs paused (inactive or ended), and sorts by next due date then name.
 */
export function buildAccountBillRosters(
  payments: readonly RecurringPayment[],
  today: Date = new Date(),
  accountIds?: Iterable<string>,
): Map<string, AccountBillRoster> {
  const map = new Map<string, AccountBillRoster>()

  if (accountIds) {
    for (const accountId of accountIds) {
      if (accountId && !map.has(accountId)) {
        map.set(accountId, createEmptyAccountBillRoster(accountId))
      }
    }
  }

  for (const payment of payments) {
    const accountId = payment.accountId
    if (!accountId) continue

    let roster = map.get(accountId)
    if (!roster) {
      roster = createEmptyAccountBillRoster(accountId)
      map.set(accountId, roster)
    }

    const monthlyEquivalent = payment.frequency === 'Annually' ? payment.amount / 12 : payment.amount
    const isEnded = hasBillingEnded(payment, today)
    const isPaused = !payment.active || isEnded

    const summary: AccountBillSummary = {
      payment,
      monthlyEquivalent,
      nextDueDate: payment.nextDueDate ?? null,
    }

    if (isPaused) {
      roster.paused.push(summary)
    } else {
      roster.active.push(summary)
      roster.monthlyTotal += monthlyEquivalent
      if (payment.paymentMode === 'AutoDeduct') {
        roster.autoDeductCount += 1
      }
    }
  }

  for (const roster of map.values()) {
    roster.active.sort(compareBillSummaries)
    roster.paused.sort(compareBillSummaries)
  }

  return map
}
