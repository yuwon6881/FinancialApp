import type { EntityKind } from './outboxTypes'

export function createFinalId(entity: EntityKind): string {
  const prefix = entity === 'transaction' ? 'tx'
    : entity === 'recurringPayment' ? 'rec'
    : entity === 'category' ? 'cat'
    : entity === 'taxReliefCategory' ? 'relief'
    : entity === 'loan' ? 'loan'
    : entity === 'ledgerAccount' ? 'acct'
    : entity === 'ledgerAccountReconcile' ? 'reconcile'
    : 'op'
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Numeric placeholder for a record whose real PK is a server-generated 32-bit int (wishlist items,
 * savings goals). Keeping it above that range prevents a collision while making the optimistic row
 * use the same final-id tie-break direction as a newly inserted server row.
 */
export function createLocalNumericId(): number {
  return Math.floor(Date.now() * 1000 + Math.random() * 1000)
}

export const createLocalWishlistId = createLocalNumericId

export function createOpId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
