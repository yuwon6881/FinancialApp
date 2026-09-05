import type { EntityKind, OpType, QueuedOp } from './outboxTypes'
import { buildMutationSuccessToast, buildUndoSuccessToast } from './mutationToast'

type ToastTone = 'info' | 'success' | 'warning' | 'error'

export interface ToastCopy {
  title: string
  message: string
  tone: ToastTone
}

export const ENTITY_LABELS: Record<EntityKind, string> = {
  transaction: 'Transaction',
  recurringPayment: 'Recurring payment',
  recurringOccurrence: 'Bill occurrence',
  wishlistItem: 'Wishlist item',
  savingsGoal: 'Savings goal',
  loan: 'Loan',
  category: 'Category',
  settings: 'Settings',
  investmentAccount: 'Investment account',
  investmentInstrument: 'Investment',
  investmentActivity: 'Investment activity',
  investmentCashFlow: 'Cash movement',
  investmentPlan: 'Investment plan',
  investmentAllocation: 'Investment classification',
  investmentAllocationOrder: 'Investment classification order',
  taxReliefCategory: 'Tax relief category',
  ledgerAccount: 'Account',
  ledgerAccountReconcile: 'Account reconciliation',
  vaultDocument: 'Vault document',
}

/** Kept beside the validator's persisted-op shape so registration tests can detect drift. */
export const WELL_FORMED_ENTITY_KINDS: readonly EntityKind[] = [
  'transaction',
  'recurringPayment',
  'recurringOccurrence',
  'wishlistItem',
  'savingsGoal',
  'category',
  'settings',
  'loan',
  'ledgerAccount',
  'ledgerAccountReconcile',
  'investmentAccount',
  'investmentInstrument',
  'investmentActivity',
  'investmentCashFlow',
  'investmentPlan',
  'investmentAllocation',
  'investmentAllocationOrder',
  'taxReliefCategory',
  'vaultDocument',
]

const TYPE_COPY: Partial<Record<OpType, { title: string; messageVerb: string }>> = {
  add: { title: 'Added', messageVerb: 'added' },
  update: { title: 'Updated', messageVerb: 'updated' },
  delete: { title: 'Deleted', messageVerb: 'deleted' },
  restore: { title: 'Restored', messageVerb: 'restored' },
  toggle: { title: 'Updated', messageVerb: 'updated' },
  purchase: { title: 'Purchased', messageVerb: 'purchased' },
  unpurchase: { title: 'Purchase Undone', messageVerb: 'unmarked as purchased' },
  reminder: { title: 'Updated', messageVerb: 'updated' },
  payEarly: { title: 'Paid Early', messageVerb: 'paid early' },
  settle: { title: 'Bill Updated', messageVerb: 'updated' },
  cleanup: { title: 'Applied', messageVerb: 'applied' },
  // Loan repayment actions. Without these the fallback reads "Loan Processed -- 'Car loan' was
  // processed", which tells the user nothing about what moved.
  advanceRepayment: { title: 'Repayment Recorded', messageVerb: 'paid ahead of schedule' },
  fullSettlement: { title: 'Loan Settled', messageVerb: 'settled in full' },
  undoRepayment: { title: 'Repayment Undone', messageVerb: 'reverted' },
}

function defaultSyncSuccessToast(op: QueuedOp): ToastCopy {
  const entityName = ENTITY_LABELS[op.entity] || 'Item'
  const typeCopy = TYPE_COPY[op.type] || { title: 'Processed', messageVerb: 'processed' }
  const payloadSnapshot = op.payload?.undoSnapshot
  const snapshot = payloadSnapshot && typeof payloadSnapshot === 'object'
    ? payloadSnapshot as Record<string, unknown>
    : undefined
  const itemName = [op.payload?.description, op.payload?.name, op.payload?.symbol, snapshot?.description, snapshot?.name, snapshot?.symbol]
    .find(value => typeof value === 'string' && value.trim().length > 0) as string | undefined
  return buildMutationSuccessToast({
    entity: entityName,
    action: typeCopy.title,
    recordName: itemName,
    messageVerb: typeCopy.messageVerb,
  })
}

// Override copy per "entity:type" key only where the default "<Entity> <action>" sentence
// sentence isn't right (e.g. a setting keyed by targetId rather than a named record) or to
// silence a specific op by returning null. Anything not listed here — including any new
// entity/op type added later — automatically gets the default copy above with zero changes
// required here.
const SUCCESS_TOAST_OVERRIDES: Partial<Record<string, (op: QueuedOp) => ToastCopy | null>> = {
  'settings:update': (op) => {
    if (op.targetId === 'darkMode') {
      return buildMutationSuccessToast({
        entity: 'Settings',
        action: 'Updated',
        recordName: 'Dark mode',
        messageVerb: op.payload?.darkMode ? 'enabled' : 'disabled',
        messageSuffix: 'Synced to the server.',
      })
    }
    if (op.targetId === 'hideSensitive') {
      return buildMutationSuccessToast({
        entity: 'Settings',
        action: 'Updated',
        recordName: 'Hide sensitive data',
        messageVerb: op.payload?.hideSensitive ? 'enabled' : 'disabled',
        messageSuffix: 'Synced to the server.',
      })
    }
    // Acknowledging an end-of-cycle summary is a silent bookkeeping write — no toast.
    if (op.targetId === 'summarySeen' || op.targetId === 'selectedPeriod') return null
    return defaultSyncSuccessToast(op)
  },
  'recurringPayment:reminder': (op) => buildMutationSuccessToast({
    entity: 'Recurring payment reminder',
    action: 'Updated',
    recordName: op.payload?.name as string | undefined,
    messageSuffix: 'Synced to the server.',
  }),
  'recurringPayment:payEarly': (op) => buildMutationSuccessToast({
    entity: 'Recurring payment',
    action: 'Paid Early',
    recordName: op.payload?.name as string | undefined,
    messageSuffix: 'Reminders for this cycle have stopped.',
  }),
  // The Undo beside this toast restores the transaction and re-attaches every document that was
  // only detached, so the one thing it cannot bring back has to be said out loud.
  'transaction:delete': (op) => {
    const deletedDocumentCount = typeof op.payload?.deletedDocumentCount === 'number'
      ? op.payload.deletedDocumentCount
      : 0
    const copy = defaultSyncSuccessToast(op)
    if (deletedDocumentCount <= 0) return copy
    return {
      ...copy,
      message: `${copy.message} ${deletedDocumentCount} attached document${deletedDocumentCount === 1 ? '' : 's'} ${deletedDocumentCount === 1 ? 'was' : 'were'} deleted for good — undo cannot bring ${deletedDocumentCount === 1 ? 'it' : 'them'} back.`,
    }
  },
  'category:cleanup': (op) => buildMutationSuccessToast({
    entity: 'Category cleanup',
    action: 'Applied',
    recordName: op.payload?.description as string | undefined,
    messageSuffix: 'Synced to the server.',
  }),
}

// Single source of truth for "queued op finished syncing" toast copy, used by the outbox
// drain loop. The runtime dispatch map lives in the lazy outboxDispatch module, so a new entity/op type gets a working
// toast automatically, and custom wording for a specific op is a one-line addition above.
/**
 * What a failed operation was trying to do, in the user's terms.
 *
 * A bulk operation has no description or name on its payload, so naming the record fell through to
 * the bare entity kind and the toast read "Couldn't sync 'transaction'" — for a batch of forty
 * rows that all just snapped back to their old dates, with no clue why.
 */
export function describeFailedOp(op: QueuedOp): string {
  if (op.entity === 'transaction' && (op.type === 'bulkMove' || op.type === 'bulkDelete' || op.type === 'bulkAdd')) {
    if (op.type === 'bulkAdd') {
      const txs = op.payload?.transactions
      const count = Array.isArray(txs) ? txs.length : 0
      return `the creation of ${count} transaction${count === 1 ? '' : 's'}`
    }
    const items = op.type === 'bulkMove' ? op.payload?.moves : op.payload?.transactionIds
    const count = Array.isArray(items) ? items.length : 0
    const verb = op.type === 'bulkMove' ? 'move' : 'deletion'
    return `the ${verb} of ${count} transaction${count === 1 ? '' : 's'}`
  }
  const named = [op.payload?.description, op.payload?.name, op.payload?.symbol]
    .find(value => typeof value === 'string' && value.trim().length > 0) as string | undefined
  if (named) return `'${named}'`
  return ENTITY_LABELS[op.entity]?.toLowerCase() || op.entity
}

export function getSyncSuccessToast(op: QueuedOp): ToastCopy | null {
  if (op.isUndo) {
    const entityName = ENTITY_LABELS[op.entity] || 'Item'
    const itemName = [op.payload?.description, op.payload?.name, op.payload?.symbol]
      .find(value => typeof value === 'string' && value.trim().length > 0) as string | undefined
    return buildUndoSuccessToast(itemName, entityName)
  }

  if (op.entity === 'transaction' && op.type === 'bulkDelete') {
    const ids = op.payload?.transactionIds
    const snapshots = op.payload?.transactions
    const count = Array.isArray(ids) ? ids.length : Array.isArray(snapshots) ? snapshots.length : 0
    return buildMutationSuccessToast({
      entity: 'Transactions',
      action: 'Deleted',
      message: `${count} transaction${count === 1 ? '' : 's'} were deleted.`,
    })
  }

  if (op.entity === 'transaction' && op.type === 'bulkAdd') {
    const txs = op.payload?.transactions
    const count = Array.isArray(txs) ? txs.length : 0
    return buildMutationSuccessToast({
      entity: 'Transactions',
      action: 'Synced',
      message: `${count} transaction${count === 1 ? '' : 's'} synced.`,
    })
  }

  if (op.entity === 'transaction' && op.type === 'bulkMove') {
    const moves = Array.isArray(op.payload?.moves) ? op.payload.moves : []
    const targetDate = moves.length > 0 ? String((moves[0] as { targetDate?: unknown })?.targetDate ?? '') : ''
    const count = moves.length
    return buildMutationSuccessToast({
      entity: 'Transactions',
      action: 'Moved',
      message: `${count} transaction${count === 1 ? '' : 's'} moved to ${targetDate || 'a new date'}.`,
    })
  }

  const key = `${op.entity}:${op.type}`
  const override = SUCCESS_TOAST_OVERRIDES[key]
  return override ? override(op) : defaultSyncSuccessToast(op)
}
