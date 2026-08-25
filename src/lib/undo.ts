import type { ToastAction } from '../components/ui/ToastViewport'
import type { InvestmentAccount, InvestmentActivity, InvestmentCashFlow, InvestmentInstrument, LedgerAccount, Loan, RecurringPayment, SavingsGoal, TaxReliefCategoryDefinition, Transaction, TransactionCategory, WishlistItem } from '../types'
import { createFinalId, createLocalNumericId, createLocalWishlistId, type DispatchResult, type EntityKind, type OutboxPayload, type QueuedOp } from './outbox'

/**
 * Note this union does NOT police which entities have undo support: its loosest member only
 * requires `{ id: string, name: string }`, so almost any domain record is structurally assignable
 * and a missing entity type-checks silently. `Loan` was absent here for as long as it was absent
 * from `buildUndoAction`, and `tsc` never flagged either. The switch below is the real registry --
 * adding a member here buys documentation, not enforcement.
 */
export type UndoSnapshot = (Transaction | RecurringPayment | TransactionCategory | WishlistItem | SavingsGoal | LedgerAccount | Loan | InvestmentAccount | InvestmentInstrument | InvestmentActivity | InvestmentCashFlow | TaxReliefCategoryDefinition) & {
  isPendingSync?: boolean
  isPendingDelete?: boolean
}

export type EnqueueUndo = (
  entity: EntityKind,
  type: QueuedOp['type'],
  targetId: string,
  payload?: OutboxPayload,
) => void

export type RequestSensitiveReveal = () => void

const snapshotKey = (entity: EntityKind, targetId: string) => `${entity}:${targetId}`
const toPayload = (value: object): OutboxPayload => ({ ...value })

export function snapshotForUndo(
  snapshots: Map<string, UndoSnapshot>,
  entity: EntityKind,
  targetId: string,
  value: UndoSnapshot | undefined,
): void {
  if (!value) return
  const key = snapshotKey(entity, targetId)
  if (snapshots.has(key)) return
  const clean = { ...value }
  delete clean.isPendingSync
  delete clean.isPendingDelete
  snapshots.set(key, clean)
}

/**
 * Drop a captured snapshot without building an undo from it. `buildUndoAction` consumes the map on
 * the success path only, so every terminal failure has to release its own key: capture is
 * first-write-wins, and a snapshot left behind by a failed op would be handed to the *next* edit of
 * the same row, whose Undo would then revert past the edit the user actually kept.
 */
export function releaseUndoSnapshot(
  snapshots: Map<string, UndoSnapshot>,
  entity: EntityKind,
  targetId: string,
): void {
  snapshots.delete(snapshotKey(entity, targetId))
}

/**
 * Follow a server-assigned id onto the snapshot map. The queue remaps `targetId` when an add
 * resolves, and these keys are built from that same id, so without this the snapshot for an
 * in-flight edit becomes unreachable and the row silently loses its Undo.
 */
export function remapUndoSnapshotTarget(
  snapshots: Map<string, UndoSnapshot>,
  entity: EntityKind,
  fromTargetId: string,
  toTargetId: string,
): void {
  if (fromTargetId === toTargetId) return
  const from = snapshotKey(entity, fromTargetId)
  const existing = snapshots.get(from)
  if (!existing) return
  snapshots.delete(from)
  const to = snapshotKey(entity, toTargetId)
  if (!snapshots.has(to)) snapshots.set(to, existing)
}

export function buildUndoAction(
  snapshots: Map<string, UndoSnapshot>,
  op: QueuedOp,
  result: DispatchResult,
  enqueue: EnqueueUndo,
  onRequestSensitiveReveal?: RequestSensitiveReveal,
): ToastAction | undefined {
  const key = snapshotKey(op.entity, op.targetId)
  const persisted = op.payload?.undoSnapshot
  const before = snapshots.get(key) ?? (persisted && typeof persisted === 'object' && 'id' in persisted
    ? persisted as UndoSnapshot
    : undefined)
  snapshots.delete(key)
  const action = (entity: EntityKind, type: QueuedOp['type'], targetId: string, payload?: OutboxPayload): ToastAction => ({
    label: 'Undo',
    onAction: () => enqueue(entity, type, targetId, payload),
  })

  switch (`${op.entity}:${op.type}`) {
    case 'transaction:bulkDelete': {
      const deleted = result && typeof result === 'object' && 'deleted' in result && Array.isArray(result.deleted)
        ? result.deleted
        : op.payload?.transactions
      return Array.isArray(deleted) && deleted.length > 0
        ? action('transaction', 'bulkRestore', String(op.targetId), { transactions: deleted })
        : undefined
    }
    case 'transaction:bulkMove': {
      const snapshots = Array.isArray(op.payload?.beforeSnapshots) ? op.payload.beforeSnapshots : []
      const moves = snapshots.flatMap(snapshot => snapshot && typeof snapshot === 'object' && 'id' in snapshot && 'date' in snapshot
        ? [{ id: String(snapshot.id), targetDate: String(snapshot.date) }]
        : [])
      // The server echoes the rows it moved, which are fresher than what we queued; fall back to
      // the original snapshots so an undo can still re-insert a parent that has left the view.
      const moved = result && typeof result === 'object' && 'moved' in result ? result.moved : []
      const rows = Array.isArray(moved) && moved.length > 0 ? moved : op.payload?.transactions
      return moves.length > 0
        ? action('transaction', 'bulkMove', String(op.targetId), {
            moves,
            beforeSnapshots: moved,
            transactions: rows,
          })
        : undefined
    }
    case 'transaction:add':
      return action('transaction', 'delete', String(op.targetId), op.payload)
    case 'recurringPayment:add':
      return action('recurringPayment', 'delete', String(op.targetId), op.payload)
    case 'ledgerAccount:add':
      return action('ledgerAccount', 'delete', String(op.targetId), op.payload)
    case 'loan:add':
      return action('loan', 'delete', String(op.targetId), op.payload)
    case 'ledgerAccountReconcile:add': {
      const undo = op.payload?.undoReconciliation
      return undo && typeof undo === 'object'
        ? action('ledgerAccountReconcile', 'add', createFinalId('ledgerAccountReconcile'), {
            name: `Undo ${op.payload?.name || 'account reconciliation'}`,
            description: 'Undo account reconciliation',
            reconciliation: undo,
          })
        : undefined
    }
    case 'recurringOccurrence:settle': {
      const transaction = result && typeof result === 'object' && 'transaction' in result
        ? result.transaction
        : undefined
      return transaction && typeof transaction === 'object' && 'id' in transaction && transaction.id != null
        ? action('transaction', 'delete', String(transaction.id), { undoSnapshot: transaction })
        : undefined
    }
    case 'category:add':
      return action('category', 'delete', String(op.targetId), op.payload)
    case 'taxReliefCategory:add': {
      const id = result && 'id' in result && result.id != null ? String(result.id) : String(op.targetId)
      return action('taxReliefCategory', 'delete', id, op.payload)
    }
    case 'investmentAccount:add':
      return action('investmentAccount', 'delete', String(op.targetId), op.payload)
    case 'investmentInstrument:add':
      return action('investmentInstrument', 'delete', String(op.targetId), op.payload)
    case 'investmentActivity:add':
      return action('investmentActivity', 'delete', String(op.targetId), op.payload)
    case 'investmentCashFlow:add':
      return action('investmentCashFlow', 'delete', String(op.targetId), op.payload)
    case 'wishlistItem:add': {
      const id = result && 'id' in result && result.id != null ? String(result.id) : String(op.targetId)
      return action('wishlistItem', 'delete', id, op.payload)
    }
    case 'savingsGoal:add': {
      // Undo has to target the server-generated int PK, not the negative local placeholder the
      // add was queued under, or the DELETE would 404.
      const id = result && 'id' in result && result.id != null ? String(result.id) : String(op.targetId)
      return action('savingsGoal', 'delete', id, op.payload)
    }
    case 'transaction:delete':
      return before ? action('transaction', 'add', String(before.id), toPayload(before)) : undefined
    case 'recurringPayment:delete':
      return before ? action('recurringPayment', 'add', String(before.id), toPayload(before)) : undefined
    case 'ledgerAccount:delete':
      return before ? action('ledgerAccount', 'add', String(before.id), toPayload(before)) : undefined
    // The loan API field-scopes both bodies to the authored terms, so the restore only has to be
    // honest for the optimistic projection: `before.snapshot` is the correct pre-edit amortisation
    // state, and `isRecalculating` is stripped from every snapshot at enqueue.
    case 'loan:delete':
      return before ? action('loan', 'add', String(before.id), toPayload(before)) : undefined
    case 'category:delete':
      return !op.payload?.replacementCategoryId && before
        ? action('category', 'add', String(before.id), toPayload(before))
        : undefined
    case 'taxReliefCategory:delete': {
      if (!before) return undefined
      const payload = { ...toPayload(before), taxYear: op.payload?.taxYear }
      delete payload.id
      return action('taxReliefCategory', 'add', createFinalId('taxReliefCategory'), payload)
    }
    case 'wishlistItem:delete': {
      if (!before) return undefined
      const payload = toPayload(before)
      delete payload.id
      return action('wishlistItem', 'add', String(createLocalWishlistId()), payload)
    }
    case 'savingsGoal:delete': {
      // The dedicated restore endpoint preserves the deleted row's cycle tally and revalidates its
      // earmark under the server's shared-pool lock. A normal add deliberately resets that tally.
      if (!before) return undefined
      const payload = toPayload(before)
      return action('savingsGoal', 'restore', String(createLocalNumericId()), payload)
    }
    case 'investmentAccount:delete':
      return before ? action('investmentAccount', 'add', String(before.id), toPayload(before)) : undefined
    case 'investmentInstrument:delete':
      return before ? action('investmentInstrument', 'add', String(before.id), toPayload(before)) : undefined
    case 'investmentActivity:delete':
      return result && typeof result === 'object' && 'transactions' in result
        ? action('investmentActivity', 'restore', String(op.targetId), result as unknown as OutboxPayload)
        : persisted && typeof persisted === 'object'
          ? action('investmentActivity', 'restore', String(op.targetId), persisted as OutboxPayload)
          : undefined
    case 'investmentCashFlow:delete':
      return result && typeof result === 'object' && 'id' in result
        ? action('investmentCashFlow', 'restore', String(op.targetId), result as OutboxPayload)
        : persisted && typeof persisted === 'object'
          ? action('investmentCashFlow', 'restore', String(op.targetId), persisted as OutboxPayload)
        : undefined
    case 'transaction:update':
      return before ? action('transaction', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'recurringPayment:update':
      return before ? action('recurringPayment', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'ledgerAccount:update':
      return before ? action('ledgerAccount', 'update', String(op.targetId), toPayload(before)) : undefined
    // Advance repayment and full settlement are server-authoritative and already reversible: the
    // server records a repayment action and owns the endpoint that reverses exactly the ledger rows
    // and occurrences it wrote. The Undo here is that endpoint, keyed by the action id the server
    // just returned -- so the toast can offer it without the client reconstructing anything. The
    // loan id travels in the payload because `targetId` is the repayment action, which is what the
    // projection needs to attribute the pending undo to its loan.
    case 'loan:advanceRepayment':
    case 'loan:fullSettlement': {
      const actionId = result && typeof result === 'object' && 'actionId' in result
        ? String((result as { actionId?: unknown }).actionId ?? '').trim()
        : ''
      if (!actionId) return undefined
      return action('loan', 'undoRepayment', actionId, {
        loanId: String(op.targetId),
        name: op.payload?.name,
      })
    }
    case 'loan:update':
      return before ? action('loan', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'recurringPayment:reminder':
      return before ? action('recurringPayment', 'reminder', String(op.targetId), {
        name: (before as any).name,
        reminderEnabled: (before as any).reminderEnabled === true,
        reminderMode: (before as any).reminderMode ?? 'Once',
        reminderLeadDays: (before as any).reminderLeadDays ?? 3,
        undoSnapshot: before,
      }) : undefined
    case 'category:update':
      return before ? action('category', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'taxReliefCategory:update':
      return before ? action('taxReliefCategory', 'update', String(op.targetId), {
        ...toPayload(before),
        taxYear: op.payload?.taxYear,
      }) : undefined
    case 'wishlistItem:update':
      return before ? action('wishlistItem', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'savingsGoal:update':
      return before ? action('savingsGoal', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'investmentAccount:update':
      return before ? action('investmentAccount', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'investmentInstrument:update':
      return before ? action('investmentInstrument', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'investmentActivity:update':
      return before ? action('investmentActivity', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'investmentCashFlow:update':
      return before ? action('investmentCashFlow', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'investmentPlan:update':
      return persisted && typeof persisted === 'object'
        ? action('investmentPlan', 'update', String(op.targetId), { ...(persisted as object) })
        : undefined
    case 'investmentAllocation:update':
      return persisted && typeof persisted === 'object'
        ? action('investmentAllocation', 'update', String(op.targetId), { ...(persisted as object) })
        : undefined
    case 'investmentAllocationOrder:update':
      return persisted && typeof persisted === 'object'
        ? action('investmentAllocationOrder', 'update', String(op.targetId), { ...(persisted as object) })
        : undefined
    case 'wishlistItem:purchase': {
      const purchase = result && 'item' in result ? result : undefined
      const id = purchase?.item?.id != null ? String(purchase.item.id) : String(op.targetId)
      const purchaseTransactionId = purchase?.item?.purchaseTransactionId || purchase?.transaction?.id
      return action('wishlistItem', 'unpurchase', id, { purchaseTransactionId, name: op.payload?.name })
    }
    case 'wishlistItem:unpurchase':
      return action('wishlistItem', 'purchase', String(op.targetId), {
        name: op.payload?.name,
        price: op.payload?.price,
        date: op.payload?.date,
      })
    case 'recurringPayment:toggle': {
      if (!op.payload || typeof op.payload.active !== 'boolean') return undefined
      const restored = before as RecurringPayment | undefined
      return action('recurringPayment', 'toggle', String(op.targetId), {
        active: !op.payload.active,
        name: op.payload.name,
        // The toggle recomputed nextDueDate, so restoring `active` alone would leave the new date
        // showing. Only send the key when we actually have the old value -- the projection applies
        // it by key presence, so an undefined would blank a date we do not know.
        ...(restored && 'nextDueDate' in restored ? { nextDueDate: restored.nextDueDate } : {}),
      })
    }
    case 'category:cleanup': {
      const undoActions = result && typeof result === 'object' && 'undoActions' in result && Array.isArray(result.undoActions)
        ? result.undoActions
        : []
      return undoActions.length > 0
        ? action('category', 'cleanup', `${op.targetId}:undo`, {
            actions: undoActions,
            description: op.payload?.description || 'AI category cleanup',
          })
        : undefined
    }
    case 'settings:update':
      if (op.targetId === 'hideSensitive' && op.payload?.hideSensitive === true) {
        // Revealing sensitive data must go through the same identity check as the
        // manual toggle. Do not silently queue the inverse privacy setting here.
        return onRequestSensitiveReveal
          ? { label: 'Undo', onAction: onRequestSensitiveReveal }
          : persisted && typeof persisted === 'object'
            ? action('settings', 'update', String(op.targetId), { ...(persisted as object) })
            : undefined
      }
      return op.targetId !== 'summarySeen' && persisted && typeof persisted === 'object'
        ? action('settings', 'update', String(op.targetId), { ...(persisted as object) })
        : undefined
    default:
      return undefined
  }
}
