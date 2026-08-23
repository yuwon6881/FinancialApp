import { projectIncomeSplitRows } from './incomeSplitProjection'
import type { EntityKind, QueuedOp } from './outboxTypes'
import { getOptimisticTransactionPostedAt } from './outboxTypes'
import { OPTIMISTIC_LIST_ORDER_POLICIES } from './outboxItemOrder'
import { splitRowState, type ApplyOpsOptions, type ProjectionRow, type ProjectionRows } from './outboxProjectionRows'

/** Projection for an op acting on the list it belongs to, plus the wishlist-to-ledger casts. */
export function applyEntityOp<T extends ProjectionRow>(
  rows: ProjectionRows<T>,
  op: QueuedOp,
  entity: EntityKind,
  options?: ApplyOpsOptions,
): void {
  const targetStr = String(op.targetId)

  if (op.type === 'add') {
    // Wishlist items and savings goals have server-generated int PKs, so an offline add carries
    // a numeric placeholder outside that range. Keep it numeric: leaving it a string breaks id
    // comparisons and the numeric ordering these lists rely on. Older negative ids remain valid.
    const parsedId = entity === 'wishlistItem' || entity === 'savingsGoal' ? Number(op.targetId) : op.targetId
    const newItem = {
      ...op.payload,
      ...(entity === 'transaction' && !op.payload?.postedAt
        ? { postedAt: getOptimisticTransactionPostedAt(op.createdAt) }
        : {}),
      id: parsedId,
      isPendingSync: !op.isCompleted
    } as T

    const existingIndex = rows.findIndex(targetStr)
    if (existingIndex >= 0) {
      rows.rows[existingIndex] = newItem
    } else {
      rows.rows = OPTIMISTIC_LIST_ORDER_POLICIES[entity]?.addPlacement === 'append'
        ? [...rows.rows, newItem]
        : [newItem, ...rows.rows]
    }
    if (entity === 'transaction') {
      rows.rows = projectIncomeSplitRows(
        rows.rows,
        targetStr,
        options?.incomeAllocations,
        splitRowState(op),
      )
    }
  } else if (op.type === 'update') {
    const existingIndex = rows.findIndex(targetStr)
    if (existingIndex >= 0) {
      if (entity === 'wishlistItem' && op.payload && op.payload.isActive === true) {
        rows.rows = rows.rows.map((item, idx) => {
          if (idx === existingIndex) {
            return {
              ...item,
              ...op.payload,
              isPendingSync: !op.isCompleted
            } as unknown as T
          }
          return {
            ...item,
            isActive: false
          } as unknown as T
        })
      } else {
        const current = rows.rows[existingIndex] as T & {
          earmarkedAmount?: number
          targetAmount?: number
          cycleFundedAmount?: number
        }
        // Same cast as `current` above: these savings-goal fields reach the row through
        // OutboxPayload's index signature, and spreading an optional payload drops that
        // signature from the inferred type.
        const projected = {
          ...rows.rows[existingIndex],
          ...op.payload,
          isPendingSync: !op.isCompleted
        } as T & {
          earmarkedAmount?: number
          targetAmount?: number
          cycleFundedAmount?: number
          isPendingSync: boolean
        }
        if (entity === 'savingsGoal'
            && typeof projected.targetAmount === 'number'
            && typeof current.earmarkedAmount === 'number'
            && current.earmarkedAmount > projected.targetAmount) {
          const released = current.earmarkedAmount - projected.targetAmount
          projected.earmarkedAmount = projected.targetAmount
          if (typeof current.cycleFundedAmount === 'number') {
            projected.cycleFundedAmount = Math.max(0, current.cycleFundedAmount - released)
          }
        }
        rows.rows[existingIndex] = projected
      }
    }
    if (entity === 'transaction') {
      // Editing a salary rewrites its bucket rows server-side, and editing income into an
      // expense removes them, so re-derive rather than leaving the old set beside the new row.
      rows.rows = projectIncomeSplitRows(
        rows.rows,
        targetStr,
        options?.incomeAllocations,
        splitRowState(op),
      )
    }
  } else if (op.type === 'delete') {
    if (entity === 'transaction' && op.entity === 'wishlistItem') {
      // Deleting a purchased wishlist item cascades to its linked ledger transaction
      // server-side (see WishlistService.DeleteWishlistItemAsync). Mirror that here so
      // the ledger row disappears immediately instead of lingering until the next
      // refresh -- the linked transaction keys off wishlistItemId, not the op targetId.
      if (op.isCompleted) {
        rows.rows = rows.rows.filter(item => {
          const wishlistItemId = (item as T & { wishlistItemId?: number | null }).wishlistItemId
          return !(wishlistItemId != null && String(wishlistItemId) === targetStr)
        })
      } else {
        rows.rows = rows.rows.map(item => {
          const wishlistItemId = (item as T & { wishlistItemId?: number | null }).wishlistItemId
          return wishlistItemId != null && String(wishlistItemId) === targetStr
            ? { ...item, isPendingDelete: true, isPendingSync: true }
            : item
        })
      }
    } else {
      if (op.isCompleted) {
        rows.rows = rows.rows.filter(item => {
          const itemStr = String(item.id)
          return !(itemStr === targetStr || itemStr.startsWith(`${targetStr}-split-`) || (itemStr.includes('-split-') && itemStr.split('-split-')[0] === targetStr))
        })
      } else {
        rows.rows = rows.rows.map(item => {
          const itemStr = String(item.id)
          if (itemStr === targetStr || itemStr.startsWith(`${targetStr}-split-`) || (itemStr.includes('-split-') && itemStr.split('-split-')[0] === targetStr)) {
            return {
              ...item,
              isPendingDelete: true,
              isPendingSync: true
            }
          }
          return item
        })
      }
    }
  } else if (op.type === 'toggle') {
    const existingIndex = rows.findIndex(targetStr)
    if (existingIndex >= 0) {
      const item = rows.rows[existingIndex] as T & { active?: boolean }
      // Prefer the absolute desired state captured at click time; only fall back to a
      // relative flip for legacy queued ops (e.g. persisted from before this fix) that
      // have no payload. A relative flip here would double-apply against a refreshed
      // base list and flicker the toggle back to the old state.
      const nextActive = op.payload && typeof op.payload.active === 'boolean' ? op.payload.active : !item.active
      rows.rows[existingIndex] = {
        ...item,
        active: nextActive,
        ...(op.payload && Object.prototype.hasOwnProperty.call(op.payload, 'nextDueDate')
          ? { nextDueDate: op.payload.nextDueDate }
          : {}),
        isPendingSync: !op.isCompleted
      }
    }
  } else if (entity === 'transaction' && op.entity === 'wishlistItem' && op.type === 'purchase') {
    const syntheticId = op.payload?.purchaseTransactionId || `wishlist-purchase-${op.targetId}`
    const newItem = {
      id: syntheticId,
      date: op.payload?.date || new Date(op.createdAt).toLocaleDateString('en-CA'),
      postedAt: op.payload?.postedAt || new Date(op.createdAt).toISOString(),
      description: `Purchased: ${op.payload?.name || 'Wishlist item'} (Wish List)`,
      category: 'Other',
      ledgerCategory: 'Rewards',
      amount: -Math.abs(Number(op.payload?.price || 0)),
      // The claim's Rewards account, mirroring what WishlistService writes. Without it this row
      // is a bucket leg belonging to no account, so the projected account balance under-counts
      // until the post-sync refresh lands and then jumps -- and the accounts drift detector
      // reports a genuine-looking mismatch for the whole window.
      accountId: typeof op.payload?.accountId === 'string' ? op.payload.accountId : undefined,
      wishlistItemId: Number(op.targetId),
      excludeFromAutocomplete: true,
      isPendingSync: !op.isCompleted
    } as unknown as T

    const existingIndex = rows.findIndex(String(syntheticId))
    if (existingIndex >= 0) {
      rows.rows[existingIndex] = {
        ...rows.rows[existingIndex],
        ...newItem
      }
    } else {
      rows.rows = [newItem, ...rows.rows]
    }
  } else if (entity === 'transaction' && op.entity === 'wishlistItem' && op.type === 'unpurchase') {
    const purchaseTransactionId = op.payload?.purchaseTransactionId
    if (purchaseTransactionId) {
      if (op.isCompleted) {
        rows.rows = rows.rows.filter(item => String(item.id) !== String(purchaseTransactionId))
      } else {
        rows.rows = rows.rows.map(item => String(item.id) === String(purchaseTransactionId)
          ? {
              ...item,
              isPendingDelete: true,
              isPendingSync: true
            }
          : item)
      }
    }
  } else if (op.type === 'purchase') {
    const existingIndex = rows.findIndex(targetStr)
    if (existingIndex >= 0) {
      const item = rows.rows[existingIndex] as T & { isPurchased?: boolean; purchasedAt?: string; purchaseTransactionId?: string | null }
      rows.rows[existingIndex] = {
        ...item,
        isPurchased: true,
        isActive: false,
        purchasedAt: op.payload?.postedAt || op.payload?.date || op.payload?.purchasedAt || new Date().toISOString(),
        purchaseTransactionId: op.payload?.purchaseTransactionId ?? item.purchaseTransactionId ?? null,
        isPendingSync: !op.isCompleted
      }
      const candidates = rows.rows
        .map((candidate, index) => ({ candidate: candidate as T & { isPurchased?: boolean; createdAt?: string }, index }))
        .filter(({ candidate, index }) => index !== existingIndex && !candidate.isPurchased)
        .sort((left, right) => String(right.candidate.createdAt ?? '').localeCompare(String(left.candidate.createdAt ?? '')))
      rows.rows = rows.rows.map((candidate, index) => ({
        ...candidate,
        isActive: candidates.length > 0 && index === candidates[0].index,
      }))
    }
  } else if (op.type === 'unpurchase') {
    const existingIndex = rows.findIndex(targetStr)
    if (existingIndex >= 0) {
      const item = rows.rows[existingIndex] as T & { isPurchased?: boolean; purchasedAt?: string; purchaseTransactionId?: string | null }
      rows.rows[existingIndex] = {
        ...item,
        isPurchased: false,
        isActive: !rows.rows.some((candidate, index) => index !== existingIndex && Boolean((candidate as T & { isActive?: boolean; isPurchased?: boolean }).isActive) && !(candidate as T & { isPurchased?: boolean }).isPurchased),
        purchasedAt: undefined,
        purchaseTransactionId: null,
        isPendingSync: !op.isCompleted
      }
    }
  } else if (op.type === 'restore') {
    // Investment activity/cash-flow undo uses a dedicated restore endpoint rather than
    // re-adding a record. Project the snapshot back into the visible list immediately so an
    // undo followed by navigation does not leave the user staring at a missing row.
    const snapshots = entity === 'savingsGoal' && op.payload
      ? [op.payload]
      : entity === 'investmentActivity' && Array.isArray(op.payload?.transactions)
      ? op.payload.transactions
      : entity === 'investmentCashFlow' && op.payload
        ? [op.payload]
        : []
    for (const snapshot of snapshots) {
      if (!snapshot || typeof snapshot !== 'object') continue
      const snapshotId = entity === 'savingsGoal'
        ? targetStr
        : 'id' in snapshot ? String(snapshot.id) : targetStr
      if (!snapshotId) continue
      const restored = {
        ...snapshot,
        id: snapshotId,
        isPendingDelete: false,
        isPendingSync: !op.isCompleted,
      } as unknown as T
      const existingIndex = rows.findIndex(snapshotId)
      if (existingIndex >= 0) rows.rows[existingIndex] = restored
      else rows.rows = [restored, ...rows.rows]
    }
  }
}
