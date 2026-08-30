import type { LedgerAccount, Transaction } from '../types'
import type { IncomeAllocations } from './incomeSplitProjection'
import { buildIncomeSplitRows } from './incomeSplitProjection'
import { accountAmount, getAccountBalances } from './accountAttribution'
import { roundMoney } from './money'
import type { QueuedOp } from './outbox'

function asTransaction(value: unknown, fallbackId?: string): Transaction | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof (raw.id ?? fallbackId) !== 'string') return null
  if (typeof raw.ledgerCategory !== 'string' || typeof raw.amount !== 'number') return null
  const splitAccountIds = raw.splitAccountIds && typeof raw.splitAccountIds === 'object'
    ? Object.fromEntries(Object.entries(raw.splitAccountIds as Record<string, unknown>)
      .filter(([, accountId]) => typeof accountId === 'string')) as Record<string, string>
    : undefined
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
    splitAccountIds,
    stabilityRecoveryTopUpAmount: typeof raw.stabilityRecoveryTopUpAmount === 'number'
      ? raw.stabilityRecoveryTopUpAmount
      : null,
    stabilityReloadIntent: raw.stabilityReloadIntent === 'Required' || raw.stabilityReloadIntent === 'NotRequired'
      ? raw.stabilityReloadIntent
      : undefined,
    isAccountBalanceAdjustment: raw.isAccountBalanceAdjustment === true,
  }
}

function addDelta(
  balances: Map<string, number>,
  transaction: Transaction,
  accounts: ReadonlyArray<LedgerAccount>,
  accountsById: ReadonlyMap<string, LedgerAccount>,
  allocations: IncomeAllocations | undefined,
  direction: 1 | -1,
) {
  const incomeSplitRows = buildIncomeSplitRows(
    transaction,
    allocations,
  )
  const rows = incomeSplitRows.length > 0 ? incomeSplitRows : [transaction]
  for (const row of rows) {
    for (const account of accounts) {
      const delta = accountAmount(row, account, accountsById)
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
  // Reconciliation is intentionally replayed in the same chronological stream as ledger
  // mutations. A target is a final balance at the point the user confirmed the setup; applying
  // it in a separate pass would either double-count an earlier queued transaction or overwrite a
  // later one.
  const projectedAccounts = accounts.map(account => ({ ...account }))
  const accountsById = new Map(projectedAccounts.map(account => [account.id, account]))
  const balances = new Map(projectedAccounts.map(account => [account.id, account.remaining]))
  const operations = activeOps
    .filter(operation => operation.entity === 'transaction' || operation.entity === 'ledgerAccountReconcile')
    .sort((left, right) => left.createdAt - right.createdAt)

  for (const operation of operations) {
    if (operation.entity === 'ledgerAccountReconcile') {
      if (operation.type !== 'add') continue
      applyReconciliation(operation, projectedAccounts, accountsById, balances)
      continue
    }
    if (operation.type === 'add') {
      const transaction = currentTransaction(operation)
      if (transaction) addDelta(balances, transaction, projectedAccounts, accountsById, incomeAllocations, 1)
      continue
    }
    if (operation.type === 'update') {
      for (const previous of snapshotTransactions(operation, baseTransactions))
        addDelta(balances, previous, projectedAccounts, accountsById, incomeAllocations, -1)
      const next = currentTransaction(operation)
      if (next) addDelta(balances, next, projectedAccounts, accountsById, incomeAllocations, 1)
      continue
    }
    if (operation.type === 'delete' || operation.type === 'bulkDelete') {
      for (const previous of snapshotTransactions(operation, baseTransactions))
        addDelta(balances, previous, projectedAccounts, accountsById, incomeAllocations, -1)
      continue
    }
    if (operation.type === 'bulkRestore') {
      for (const restored of snapshotTransactions(operation, baseTransactions))
        addDelta(balances, restored, projectedAccounts, accountsById, incomeAllocations, 1)
    }
  }

  return projectedAccounts.map(account => ({
    ...account,
    remaining: roundMoney(balances.get(account.id) ?? account.remaining),
  }))
}

function applyReconciliation(
  operation: QueuedOp,
  accounts: LedgerAccount[],
  accountsById: Map<string, LedgerAccount>,
  balances: Map<string, number>,
): void {
  const raw = operation.payload?.reconciliation
  if (!raw || typeof raw !== 'object') return
  const reconciliation = raw as {
    bucket?: unknown
    targets?: unknown
  }
  if (typeof reconciliation.bucket !== 'string' || !Array.isArray(reconciliation.targets)) return

  for (const rawTarget of reconciliation.targets) {
    if (!rawTarget || typeof rawTarget !== 'object') continue
    const target = rawTarget as Record<string, unknown>
    const id = typeof target.id === 'string' && target.id.trim() ? target.id.trim() : null
    const name = typeof target.name === 'string' ? target.name : ''
    const targetBalance = typeof target.target === 'number' && Number.isFinite(target.target)
      ? roundMoney(target.target)
      : null
    if (!id || targetBalance === null || !name) continue
    const normalizedKind = target.kind === 'EWallet' || target.kind === 'Cash' || target.kind === 'Card' || target.kind === 'Other' || target.kind === 'Bank'
      ? target.kind
      : undefined
    let account = accounts.find(candidate => candidate.id === id)
    if (!account) {
      account = {
        ...target,
        id,
        name,
        bucket: reconciliation.bucket as LedgerAccount['bucket'],
        kind: normalizedKind ?? 'Bank',
        isArchived: target.isArchived === true,
        remaining: 0,
        createdAt: new Date(operation.createdAt).toISOString(),
        updatedAt: new Date(operation.createdAt).toISOString(),
        isPendingSync: !operation.isCompleted,
        pendingSyncOperationId: operation.isCompleted ? undefined : operation.id,
      } as unknown as LedgerAccount
      accounts.push(account)
      accountsById.set(id, account)
    } else {
      const isBalanceChanged = Math.abs(account.remaining - targetBalance) >= 0.005
      const isNameChanged = account.name !== name
      const isKindChanged = normalizedKind !== undefined && account.kind !== normalizedKind
      const isArchivedChanged = account.isArchived !== (target.isArchived === true)
      const hasChanged = isBalanceChanged || isNameChanged || isKindChanged || isArchivedChanged

      account.name = name
      if (normalizedKind) account.kind = normalizedKind
      account.isArchived = target.isArchived === true
      if (hasChanged) {
        account.isPendingSync = !operation.isCompleted
        account.pendingSyncOperationId = operation.isCompleted ? undefined : operation.id
      }
    }

    balances.set(id, targetBalance)
  }
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
    remaining: roundMoney(account.remaining
      + (projectedEffects.get(account.id) ?? 0)
      - (baseEffects.get(account.id) ?? 0)),
  }))
}
