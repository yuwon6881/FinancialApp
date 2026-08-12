import type { LedgerAccount, Transaction } from '../types'
import type { IncomeAllocations } from './incomeSplitProjection'
import { buildIncomeSplitRows } from './incomeSplitProjection'
import { accountAmount, getAccountBalances } from './accountAttribution'
import type { QueuedOp } from './outbox'

function asTransaction(value: unknown, fallbackId?: string): Transaction | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof (raw.id ?? fallbackId) !== 'string') return null
  if (typeof raw.ledgerCategory !== 'string' || typeof raw.amount !== 'number') return null
  return {
    id: String(raw.id ?? fallbackId),
    date: typeof raw.date === 'string' ? raw.date : '',
    postedAt: typeof raw.postedAt === 'string' ? raw.postedAt : undefined,
    description: typeof raw.description === 'string' ? raw.description : '',
    category: typeof raw.category === 'string' ? raw.category : '',
    ledgerCategory: raw.ledgerCategory,
    amount: raw.amount,
    accountId: typeof raw.accountId === 'string' ? raw.accountId : null,
    counterAccountId: typeof raw.counterAccountId === 'string' ? raw.counterAccountId : null,
    stabilityRecoveryTopUpAmount: typeof raw.stabilityRecoveryTopUpAmount === 'number'
      ? raw.stabilityRecoveryTopUpAmount
      : null,
  }
}

function addDelta(
  balances: Map<string, number>,
  transaction: Transaction,
  accounts: ReadonlyArray<LedgerAccount>,
  allocations: IncomeAllocations | undefined,
  direction: 1 | -1,
) {
  const accountsById = new Map(accounts.map(account => [account.id, account]))
  const defaults = new Map(
    accounts
      .filter(account => account.isDefault && !account.isArchived)
      .map(account => [account.bucket.toLowerCase(), account.id]),
  )
  const rows = [transaction, ...buildIncomeSplitRows(transaction, allocations)]
  for (const row of rows) {
    for (const account of accounts) {
      const delta = accountAmount(row, account, accountsById, defaults)
      balances.set(account.id, (balances.get(account.id) ?? 0) + direction * delta)
    }
  }
}

function snapshotTransactions(op: QueuedOp, base: ReadonlyArray<Transaction>): Transaction[] {
  if (op.entity !== 'transaction') return []
  if (op.type === 'bulkDelete' || op.type === 'bulkRestore') {
    return (Array.isArray(op.payload?.transactions) ? op.payload.transactions : [])
      .map(value => asTransaction(value))
      .filter((value): value is Transaction => value !== null)
  }
  const fromUndo = asTransaction(op.payload?.undoSnapshot, op.targetId)
  if (fromUndo) return [fromUndo]
  const fromBase = base.find(transaction => String(transaction.id) === op.targetId)
  return fromBase ? [fromBase] : []
}

function currentTransaction(op: QueuedOp): Transaction | null {
  if (op.entity !== 'transaction' || op.type === 'delete' || op.type === 'bulkDelete') return null
  if (op.type === 'bulkRestore') return null
  return asTransaction({ ...(op.payload ?? {}), id: op.targetId }, op.targetId)
}

/**
 * Projects queued transaction effects onto the server's cumulative account snapshot. The client
 * only has the selected-cycle ledger, so recomputing from local rows would undercount history.
 */
export function projectAccountBalances(
  accounts: ReadonlyArray<LedgerAccount>,
  activeOps: ReadonlyArray<QueuedOp>,
  baseTransactions: ReadonlyArray<Transaction> = [],
  incomeAllocations?: IncomeAllocations,
): LedgerAccount[] {
  const balances = new Map(accounts.map(account => [account.id, account.remaining]))
  const operations = activeOps
    .filter(operation => operation.entity === 'transaction')
    .sort((left, right) => left.createdAt - right.createdAt)

  for (const operation of operations) {
    if (operation.type === 'add') {
      const transaction = currentTransaction(operation)
      if (transaction) addDelta(balances, transaction, accounts, incomeAllocations, 1)
      continue
    }
    if (operation.type === 'update') {
      for (const previous of snapshotTransactions(operation, baseTransactions))
        addDelta(balances, previous, accounts, incomeAllocations, -1)
      const next = currentTransaction(operation)
      if (next) addDelta(balances, next, accounts, incomeAllocations, 1)
      continue
    }
    if (operation.type === 'delete' || operation.type === 'bulkDelete') {
      for (const previous of snapshotTransactions(operation, baseTransactions))
        addDelta(balances, previous, accounts, incomeAllocations, -1)
      continue
    }
    if (operation.type === 'bulkRestore') {
      for (const restored of snapshotTransactions(operation, baseTransactions))
        addDelta(balances, restored, accounts, incomeAllocations, 1)
    }
  }

  return accounts.map(account => ({
    ...account,
    remaining: Math.round((balances.get(account.id) ?? account.remaining) * 100) / 100,
  }))
}

/**
 * Applies the selected-cycle transaction delta to a server account snapshot. The snapshot may be
 * cumulative while the client only has one cycle of rows, so the base effect is removed before
 * the projected effect is added; replaying the selected rows from zero would undercount history.
 */
export function projectAccountBalancesFromTransactions(
  snapshot: ReadonlyArray<LedgerAccount>,
  baseTransactions: ReadonlyArray<Transaction>,
  projectedTransactions: ReadonlyArray<Transaction>,
): LedgerAccount[] {
  const baseEffects = getAccountBalances(baseTransactions, snapshot)
  const projectedEffects = getAccountBalances(projectedTransactions, snapshot)
  return snapshot.map(account => ({
    ...account,
    remaining: Math.round((account.remaining
      + (projectedEffects.get(account.id) ?? 0)
      - (baseEffects.get(account.id) ?? 0)) * 100) / 100,
  }))
}
