import type { EntityKind, OpType, OutboxPayload, QueuedOp } from './outboxTypes'
import { getOptimisticTransactionPostedAt } from './outboxTypes'
import { createOpId } from './outboxIds'

/**
 * Keep the first `undoSnapshot` when a follow-up mutation collapses into an already-queued op.
 * Undo has to return the row to the state before the user's first offline edit; a later edit's
 * snapshot is an intermediate state they never asked to keep. The `reminder` branch below has
 * always done this -- `update` and `toggle` did not, so repeated offline edits walked the snapshot
 * forward and Undo became a no-op.
 */
const withFirstUndoSnapshot = (
  merged: OutboxPayload,
  existing: OutboxPayload | undefined,
  incoming: OutboxPayload | undefined,
): OutboxPayload => {
  const first = existing?.undoSnapshot ?? incoming?.undoSnapshot
  if (first === undefined) return withoutUndoSnapshot(merged)
  return { ...merged, undoSnapshot: first }
}

/**
 * An unsent add has no "before" state -- undoing it is a delete, not a restore -- so a snapshot
 * merged in from a follow-up edit is dead weight in the cached queue.
 */
const withoutUndoSnapshot = (merged: OutboxPayload): OutboxPayload => {
  const next = { ...merged }
  delete next.undoSnapshot
  return next
}

/**
 * Strip optimistic projection markers off a persisted snapshot. Callers hand us the row straight
 * out of `applyOpsToList`, which stamps these flags, and a snapshot is a *server* state: restoring
 * one after a reload would otherwise send `isPendingSync: true` back to the API. Cleaning here
 * rather than at each enqueue site keeps it true for every entity, present and future.
 *
 * Only the markers go. Projection reads this field as input (see `loanProjection`,
 * `accountProjection`), and both depend on the money and identity fields, which are untouched.
 */
const cleanEnqueuedUndoSnapshot = (payload: OutboxPayload | undefined): OutboxPayload | undefined => {
  const snapshot = payload?.undoSnapshot
  if (!payload || !snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return payload
  const cleaned = { ...(snapshot as Record<string, unknown>) }
  delete cleaned.isPendingSync
  delete cleaned.isPendingDelete
  delete cleaned.pendingSyncOperationId
  delete cleaned.isRecalculating
  return { ...payload, undoSnapshot: cleaned as OutboxPayload['undoSnapshot'] }
}

export function enqueue(
  queue: QueuedOp[],
  entity: EntityKind,
  type: OpType,
  targetId: string,
  rawPayload?: OutboxPayload,
  isUndo?: boolean,
  activeSyncOpId?: string | null
): QueuedOp[] {
  const targetIdStr = String(targetId)
  const createdAt = Date.now()
  // Cleaned once, up front, so every branch below (and the op we queue) carries a snapshot free of
  // optimistic markers.
  const payload = cleanEnqueuedUndoSnapshot(rawPayload)
  const timestampedPayload = entity === 'transaction' && type === 'add' && !payload?.postedAt
    ? { ...payload, postedAt: getOptimisticTransactionPostedAt(createdAt) }
    : (entity === 'investmentActivity' || entity === 'investmentCashFlow') && type === 'add' && !payload?.createdAt
      ? { ...payload, createdAt: getOptimisticTransactionPostedAt(createdAt) }
      : payload
  const newOp: QueuedOp = {
    id: createOpId(),
    entity,
    type,
    targetId: targetIdStr,
    payload: timestampedPayload,
    createdAt,
    retryCount: 0,
    isUndo
  }

  const sameTarget = (op: QueuedOp) => op.entity === entity && op.targetId === targetIdStr
  const queuedAdd = queue.find(op => sameTarget(op) && op.type === 'add')
  const queuedAddNotInFlight = queuedAdd !== undefined && queuedAdd.id !== activeSyncOpId

  const queuedDelete = queue.find(op => sameTarget(op) && op.type === 'delete')
  const hasQueuedDelete = queuedDelete !== undefined

  if (type === 'delete') {
    if (hasQueuedDelete) {
      // Already queued for deletion: collapse the duplicate so we never fire a
      // second DELETE at a row the first one already removed (would 404).
      return queue
    }
    if (queuedAddNotInFlight) {
      // Delete against a target with an unsent add: drop every op for that target. Historical
      // ledger transactions are independent records, including rows linked to recurring payments.
      return queue.filter(op => !sameTarget(op))
    } else {
      // Delete against existing entity: drop queued update/toggle/purchase/unpurchase (not in-flight) for that target & append delete
      const filtered = queue.filter(op => !(sameTarget(op) && (op.type === 'update' || op.type === 'toggle' || op.type === 'purchase' || op.type === 'unpurchase') && op.id !== activeSyncOpId))
      return [...filtered, newOp]
    }
  }

  // A record already queued for deletion can't be meaningfully mutated further:
  // any update/toggle/purchase would replay against a row the delete removes.
  // Drop it (delete wins) rather than queue an op destined to 404.
  if (hasQueuedDelete && (type === 'update' || type === 'toggle' || type === 'purchase' || type === 'unpurchase')) {
    return queue
  }

  if (type === 'update') {
    if (queuedAddNotInFlight) {
      // Update against an unsent add: merge into the add op's payload
      return queue.map(op => {
        if (op.entity === entity && op.targetId === targetIdStr && op.type === 'add') {
          return {
            ...op,
            payload: withoutUndoSnapshot({ ...op.payload, ...payload })
          }
        }
        return op
      })
    } else {
      // Update against existing entity: replace existing queued update payload or append
      const existingUpdateIndex = queue.findIndex(op => op.entity === entity && op.targetId === targetIdStr && op.type === 'update' && op.id !== activeSyncOpId)
      if (existingUpdateIndex >= 0) {
        const next = [...queue]
        const existingPayload = next[existingUpdateIndex].payload
        next[existingUpdateIndex] = {
          ...next[existingUpdateIndex],
          payload: withFirstUndoSnapshot({ ...existingPayload, ...payload }, existingPayload, payload)
        }
        return next
      }
      return [...queue, newOp]
    }
  }

  if (type === 'toggle') {
    // payload carries the desired absolute { active } state (mirrors 'update'),
    // so replaying this op against a stale or freshly-refetched base list is idempotent.
    if (queuedAddNotInFlight) {
      // Toggle against an unsent add: set active in place on add payload
      return queue.map(op => {
        if (op.entity === entity && op.targetId === targetIdStr && op.type === 'add') {
          const nextActive = payload && typeof payload.active === 'boolean' ? payload.active : op.payload?.active !== true
          return {
            ...op,
            payload: { ...op.payload, active: nextActive }
          }
        }
        return op
      })
    } else {
      // Toggle against an existing entity: replace existing queued toggle payload or append
      const existingToggleIndex = queue.findIndex(op => op.entity === entity && op.targetId === targetIdStr && op.type === 'toggle' && op.id !== activeSyncOpId)
      if (existingToggleIndex >= 0) {
        const next = [...queue]
        // The toggle payload is the absolute desired state, so it replaces rather than merges --
        // but the first snapshot still has to survive for Undo.
        const existingPayload = next[existingToggleIndex].payload
        next[existingToggleIndex] = {
          ...next[existingToggleIndex],
          payload: withFirstUndoSnapshot({ ...payload }, existingPayload, payload),
        }
        return next
      }
      return [...queue, newOp]
    }
  }

  if (type === 'add') {
    if (hasQueuedDelete) {
      // A queued delete + a re-add of the same id cancel out (e.g. undoing a
      // not-yet-synced delete). The row still exists server-side, so just drop
      // the pending delete instead of round-tripping delete-then-add.
      const deleteNotInFlight = queuedDelete !== undefined && queuedDelete.id !== activeSyncOpId
      if (deleteNotInFlight) {
        return queue.filter(op => !(sameTarget(op) && op.type === 'delete'))
      }
    }
    if (queuedAddNotInFlight) {
      // Defensive: never queue two adds for the same id -- merge the payloads.
      return queue.map(op => (sameTarget(op) && op.type === 'add')
        ? { ...op, payload: { ...op.payload, ...payload } }
        : op)
    }
    return [...queue, newOp]
  }

  if (type === 'reminder') {
    if (hasQueuedDelete) return queue
    const existingReminder = queue.find(op => sameTarget(op) && op.type === 'reminder')
    if (existingReminder && existingReminder.id !== activeSyncOpId) {
      return queue.map(op => op.id === existingReminder.id
        ? {
            ...op,
            payload: {
              ...op.payload,
              ...payload,
              // Keep the first pre-change snapshot so Undo always returns to the state before
              // the user's first edit, even if the control is changed several times offline.
              undoSnapshot: op.payload?.undoSnapshot ?? payload?.undoSnapshot,
            },
          }
        : op)
    }
    return [...queue, newOp]
  }

  if (type === 'payEarly') {
    if (hasQueuedDelete || queue.some(op => sameTarget(op) && op.type === 'payEarly')) return queue
    return [...queue, newOp]
  }

  if (type === 'settle') {
    // Same occurrence AND same amount is a duplicate submit; same occurrence for a different amount
    // is a second part payment and has to queue on its own. A full settlement (no amount) still
    // collapses against another full settlement, as it always did.
    const settleAmount = typeof payload?.amount === 'number' ? payload.amount : undefined
    const duplicate = queue.some(op => op.entity === entity
      && op.targetId === targetIdStr
      && op.type === 'settle'
      && (typeof op.payload?.amount === 'number' ? op.payload.amount : undefined) === settleAmount)
    if (duplicate) return queue
    return [...queue, newOp]
  }

  if (type === 'cleanup') {
    if (queue.some(op => sameTarget(op) && op.type === 'cleanup')) return queue
    return [...queue, newOp]
  }

  if (type === 'purchase') {
    // Collapse duplicate purchases so a double-tap can't fire two calls.
    if (queue.some(op => sameTarget(op) && op.type === 'purchase')) {
      return queue
    }
    return [...queue, newOp]
  }

  if (type === 'unpurchase') {
    const queuedPurchase = queue.find(op => sameTarget(op) && op.type === 'purchase')
    if (queuedPurchase && queuedPurchase.id !== activeSyncOpId) {
      return queue.filter(op => !(sameTarget(op) && op.type === 'purchase'))
    }
    if (queue.some(op => sameTarget(op) && op.type === 'unpurchase')) {
      return queue
    }
    return [...queue, newOp]
  }

  return [...queue, newOp]
}

