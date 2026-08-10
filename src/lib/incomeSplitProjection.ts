// Optimistic projection of the four bucket rows the server generates for income.
//
// Saving a salary is the one ledger mutation that creates rows the client never authored:
// `TransactionPersistenceService.AddIncomeSplitTransactions` writes an Essentials/Growth/
// Stability/Rewards transfer beside the income row. Without this, every other mutation
// appeared instantly while a salary sat alone until the post-sync reload dropped four rows
// in — the one entry where the offline queue looked broken.
//
// The cent allocation, ids, descriptions and categories mirror that method exactly, so the
// projected rows are identical to the ones that replace them on reconcile. A plain `Income`
// row is split by the stored plan (the form encodes anything else, an accepted emergency-fund
// top-up included, as `IncomeSplit:` percentages); only a server-side clamp of a proposed
// split — an offline replay against a balance that has since moved — can shift them, and the
// refresh corrects that the same way it corrects every other projection.

import type { Transaction } from '../types'

/** Same order as `FinancialConstants.BudgetCategories` and the `IncomeSplit:` spec. */
const BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards']

export interface IncomeAllocations {
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
}

/** The shares a saved income row will be split by, or `null` when it generates no rows. */
function resolveIncomeSplitShares(
  transaction: Pick<Transaction, 'ledgerCategory' | 'amount' | 'stabilityRecoveryTopUpAmount'>,
  allocations: IncomeAllocations | undefined,
): number[] | null {
  const { ledgerCategory, amount } = transaction
  if (!(amount > 0)) return null

  const shares = ledgerCategory?.startsWith('IncomeSplit:')
    ? ledgerCategory.slice(12).split(',').map(Number)
    : ledgerCategory === 'Income' && allocations
      ? resolveExplicitRecoveryShares(transaction, allocations)
      : null
  if (!shares || shares.length !== 4) return null
  return shares.some(share => share > 0) ? shares : null
}

function resolveExplicitRecoveryShares(
  transaction: Pick<Transaction, 'amount' | 'stabilityRecoveryTopUpAmount'>,
  allocations: IncomeAllocations,
): number[] {
  const shares = [
    allocations.essentialsAlloc,
    allocations.growthAlloc,
    allocations.stabilityAlloc,
    allocations.rewardsAlloc,
  ]
  const topUp = Math.max(0, transaction.stabilityRecoveryTopUpAmount ?? 0)
  const otherTotal = shares[0] + shares[1] + shares[3]
  if (!(topUp > 0) || !(transaction.amount > 0) || !(otherTotal > 0)) return shares

  const movedShare = Math.min(topUp / transaction.amount, otherTotal)
  for (const index of [0, 1, 3]) shares[index] -= movedShare * (shares[index] / otherTotal)
  shares[2] += movedShare
  return shares
}

/**
 * The bucket rows a saved income transaction will generate, or `[]` when it generates none
 * (an expense, a zero split, or a plain `Income` saved before any plan was loaded).
 */
export function buildIncomeSplitRows(
  transaction: Pick<Transaction, 'id' | 'date' | 'postedAt' | 'description' | 'ledgerCategory' | 'amount' | 'stabilityRecoveryTopUpAmount'>,
  allocations: IncomeAllocations | undefined,
): Transaction[] {
  const shares = resolveIncomeSplitShares(transaction, allocations)?.map(share => share > 0 ? share : 0)
  const shareTotal = shares?.reduce((sum, share) => sum + share, 0) ?? 0
  if (!shares || !(shareTotal > 0)) return []

  // Largest-remainder allocation in integer cents, as the server does. Rounding each bucket on
  // its own would leave the four rows adding up to a cent more or less than the salary.
  const totalCents = Math.round(transaction.amount * 100)
  const exact = shares.map(share => (totalCents * share) / shareTotal)
  const cents = exact.map(Math.floor)
  const byRemainder = cents
    .map((_, index) => index)
    .sort((left, right) => (exact[right] - cents[right]) - (exact[left] - cents[left]) || left - right)
  const remaining = totalCents - cents.reduce((sum, value) => sum + value, 0)
  for (let i = 0; i < remaining; i += 1) cents[byRemainder[i % 4]] += 1

  // Deliberately do not copy stabilityReloadIntent: generated children are positive credits, never
  // drawdowns, and the replay groups the Stability child with its income parent.
  return BUCKETS.flatMap((bucket, index) => cents[index] <= 0 ? [] : [{
    id: `${transaction.id}-split-${bucket}`,
    date: transaction.date,
    postedAt: transaction.postedAt,
    description: `[Split: ${bucket}] ${transaction.description}`,
    category: 'Transfer',
    ledgerCategory: `Transfer:Income->${bucket}`,
    amount: cents[index] / 100,
  }])
}

/**
 * Replace the generated bucket rows belonging to one transaction.
 *
 * Rebuilding from scratch keeps the projection idempotent across replays and covers the edits
 * that change the set: a different amount, a different split, or income turned into an expense
 * (which yields no rows at all). Placement is not meaningful — every ledger surface sorts.
 */
export function projectIncomeSplitRows<T extends { id: string | number }>(
  list: T[],
  parentId: string,
  allocations: IncomeAllocations | undefined,
  rowState: Partial<Transaction>,
): T[] {
  const rest = list.filter(item => !String(item.id).startsWith(`${parentId}-split-`))
  const parent = rest.find(item => String(item.id) === parentId) as (T & Transaction) | undefined
  if (!parent) return rest

  const rows = buildIncomeSplitRows(parent, allocations)
  return rows.length === 0 ? rest : [...rest, ...rows.map(row => ({ ...row, ...rowState }) as unknown as T)]
}
