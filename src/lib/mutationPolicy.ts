export type MutationMode = 'queued' | 'direct-online' | 'local-only' | 'irreversible' | 'security-sensitive'

export interface MutationPolicy {
  mode: MutationMode
  projection: 'optimistic' | 'busy-state' | 'local'
  retry: 'outbox' | 'user' | 'none'
  toast: 'outbox' | 'caller' | 'none'
  undo: 'supported' | 'exempt'
  undoExemption?: string
}

const queued = (undo: MutationPolicy['undo'], undoExemption?: string): MutationPolicy => ({
  mode: 'queued', projection: 'optimistic', retry: 'outbox', toast: 'outbox', undo, undoExemption,
})
const noSafeInverse = 'No stale-safe inverse exists for this server mutation.'

/**
 * Mutation policy is deliberately key-explicit. The registry test compares these keys with the
 * dispatch registry, so adding a queued mutation without deciding projection, retry, toast and
 * Undo-or-exemption semantics fails CI.
 */
export const QUEUED_MUTATION_POLICIES: Record<string, MutationPolicy> = {
  // Wire-only: never enqueued. The drain loop coalesces consecutive transaction:add ops into
  // this synthetic op, so it inherits transaction:add semantics and each row stays undoable.
  'transaction:bulkAdd': queued('supported'),
  'transaction:bulkDelete': queued('supported'), 'transaction:bulkRestore': queued('exempt', noSafeInverse),
  'transaction:bulkMove': queued('supported'), 'transaction:add': queued('supported'),
  'transaction:update': queued('supported'), 'transaction:delete': queued('supported'),
  'recurringPayment:add': queued('supported'), 'recurringPayment:update': queued('supported'),
  'recurringPayment:delete': queued('supported'), 'recurringPayment:toggle': queued('supported'),
  'recurringPayment:reminder': queued('supported'), 'recurringPayment:payEarly': queued('exempt', 'Legacy replay path; new settlements use the occurrence operation.'),
  'recurringOccurrence:settle': queued('supported'),
  'wishlistItem:add': queued('supported'), 'wishlistItem:update': queued('supported'),
  'wishlistItem:delete': queued('supported'), 'wishlistItem:purchase': queued('supported'),
  'wishlistItem:unpurchase': queued('supported'),
  'savingsGoal:add': queued('supported'), 'savingsGoal:update': queued('supported'),
  'savingsGoal:delete': queued('supported'), 'savingsGoal:restore': queued('exempt', noSafeInverse),
  'loan:add': queued('supported'), 'loan:update': queued('supported'), 'loan:delete': queued('supported'),
  'loan:advanceRepayment': queued('supported'), 'loan:fullSettlement': queued('supported'),
  'loan:undoRepayment': queued('exempt', 'This operation is itself a server-authoritative Undo.'),
  'ledgerAccount:add': queued('supported'), 'ledgerAccount:update': queued('supported'),
  'ledgerAccount:delete': queued('supported'), 'ledgerAccountReconcile:add': queued('supported'),
  'category:add': queued('supported'), 'category:update': queued('supported'),
  'category:delete': queued('exempt', 'Replacement deletion rewrites historical references and is intentionally irreversible.'),
  'category:cleanup': queued('supported'), 'settings:update': queued('supported'),
  'investmentAccount:add': queued('supported'), 'investmentAccount:update': queued('supported'),
  'investmentAccount:delete': queued('supported'), 'investmentInstrument:add': queued('supported'),
  'investmentInstrument:update': queued('supported'), 'investmentInstrument:delete': queued('supported'),
  'investmentActivity:add': queued('supported'), 'investmentActivity:update': queued('supported'),
  'investmentActivity:delete': queued('supported'), 'investmentActivity:restore': queued('exempt', noSafeInverse),
  'investmentCashFlow:add': queued('supported'), 'investmentCashFlow:update': queued('supported'),
  'investmentCashFlow:delete': queued('supported'), 'investmentCashFlow:restore': queued('exempt', noSafeInverse),
  'investmentPlan:update': queued('supported'), 'investmentAllocation:update': queued('supported'),
  'investmentAllocationOrder:update': queued('supported'),
  'taxReliefCategory:add': queued('supported'), 'taxReliefCategory:update': queued('supported'),
  'taxReliefCategory:delete': queued('supported'), 'vaultDocument:update': queued('supported'),
}

export const DIRECT_MUTATION_POLICIES = {
  'vaultDocument:upload': { mode: 'direct-online', projection: 'busy-state', retry: 'user', toast: 'caller', undo: 'supported' },
  'vaultDocument:delete': { mode: 'irreversible', projection: 'busy-state', retry: 'user', toast: 'caller', undo: 'exempt', undoExemption: 'Storage deletion cannot be restored.' },
  'draft:delete': { mode: 'local-only', projection: 'local', retry: 'none', toast: 'caller', undo: 'supported' },
  'pushChannel:update': { mode: 'security-sensitive', projection: 'busy-state', retry: 'user', toast: 'caller', undo: 'supported' },
  'savingsGoal:fundCycle': { mode: 'direct-online', projection: 'busy-state', retry: 'user', toast: 'caller', undo: 'supported' },
  'authentication:update': { mode: 'security-sensitive', projection: 'busy-state', retry: 'user', toast: 'caller', undo: 'exempt', undoExemption: 'Authentication and credential changes require a fresh verified action.' },
} as const satisfies Record<string, MutationPolicy>
