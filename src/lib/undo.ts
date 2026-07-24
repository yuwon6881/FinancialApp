import type { ToastAction } from '../components/ui/ToastViewport'
import type { InvestmentAccount, InvestmentActivity, InvestmentCashFlow, InvestmentInstrument, RecurringPayment, Transaction, TransactionCategory, WishlistItem } from '../types'
import { createLocalWishlistId, type DispatchResult, type EntityKind, type OutboxPayload, type QueuedOp } from './outbox'

export type UndoSnapshot = (Transaction | RecurringPayment | TransactionCategory | WishlistItem | InvestmentAccount | InvestmentInstrument | InvestmentActivity | InvestmentCashFlow) & {
  isPendingSync?: boolean
  isPendingDelete?: boolean
}

export type EnqueueUndo = (
  entity: EntityKind,
  type: QueuedOp['type'],
  targetId: string,
  payload?: OutboxPayload,
) => void

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

export function buildUndoAction(
  snapshots: Map<string, UndoSnapshot>,
  op: QueuedOp,
  result: DispatchResult,
  enqueue: EnqueueUndo,
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
    case 'transaction:add':
      return action('transaction', 'delete', String(op.targetId))
    case 'recurringPayment:add':
      return action('recurringPayment', 'delete', String(op.targetId))
    case 'category:add':
      return action('category', 'delete', String(op.targetId))
    case 'investmentAccount:add':
      return action('investmentAccount', 'delete', String(op.targetId))
    case 'investmentInstrument:add':
      return action('investmentInstrument', 'delete', String(op.targetId))
    case 'investmentActivity:add':
      return action('investmentActivity', 'delete', String(op.targetId))
    case 'investmentManualPrice:add':
      return action('investmentManualPrice', 'delete', String(op.targetId))
    case 'investmentCashFlow:add':
      return action('investmentCashFlow', 'delete', String(op.targetId))
    case 'wishlistItem:add': {
      const id = result && 'id' in result && result.id != null ? String(result.id) : String(op.targetId)
      return action('wishlistItem', 'delete', id)
    }
    case 'transaction:delete':
      return before ? action('transaction', 'add', String(before.id), toPayload(before)) : undefined
    case 'recurringPayment:delete':
      return before ? action('recurringPayment', 'add', String(before.id), toPayload(before)) : undefined
    case 'category:delete':
      return !op.payload?.replacementCategoryId && before
        ? action('category', 'add', String(before.id), toPayload(before))
        : undefined
    case 'wishlistItem:delete': {
      if (!before) return undefined
      const payload = toPayload(before)
      delete payload.id
      return action('wishlistItem', 'add', String(createLocalWishlistId()), payload)
    }
    case 'investmentAccount:delete':
      return before ? action('investmentAccount', 'add', String(before.id), toPayload(before)) : undefined
    case 'investmentInstrument:delete':
      return before ? action('investmentInstrument', 'add', String(before.id), toPayload(before)) : undefined
    case 'investmentManualPrice:delete':
      return persisted && typeof persisted === 'object'
        ? action('investmentManualPrice', 'add', String(op.targetId), { ...(persisted as object), id: op.targetId })
        : undefined
    case 'investmentActivity:delete':
      return persisted && typeof persisted === 'object'
        ? action('investmentActivity', 'restore', String(op.targetId), persisted as OutboxPayload)
        : undefined
    case 'investmentCashFlow:delete':
      return persisted && typeof persisted === 'object'
        ? action('investmentCashFlow', 'restore', String(op.targetId), persisted as OutboxPayload)
        : undefined
    case 'transaction:update':
      return before ? action('transaction', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'recurringPayment:update':
      return before ? action('recurringPayment', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'wishlistItem:update':
      return before ? action('wishlistItem', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'investmentAccount:update':
      return before ? action('investmentAccount', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'investmentInstrument:update':
      return before ? action('investmentInstrument', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'investmentActivity:update':
      return before ? action('investmentActivity', 'update', String(op.targetId), toPayload(before)) : undefined
    case 'wishlistItem:purchase': {
      const purchase = result && 'item' in result ? result : undefined
      const id = purchase?.item?.id != null ? String(purchase.item.id) : String(op.targetId)
      const purchaseTransactionId = purchase?.item?.purchaseTransactionId || purchase?.transaction?.id
      return action('wishlistItem', 'unpurchase', id, { purchaseTransactionId })
    }
    case 'recurringPayment:toggle': {
      if (!op.payload || typeof op.payload.active !== 'boolean') return undefined
      return action('recurringPayment', 'toggle', String(op.targetId), { active: !op.payload.active })
    }
    default:
      return undefined
  }
}
