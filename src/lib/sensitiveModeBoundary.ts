import type { EntityKind, OpType, OutboxPayload } from './outbox'
import type { SensitivePreferenceStatus } from '../app/useAppPreferences'

export function isSensitiveMutationAllowed(
  hideSensitive: boolean,
  sensitivePreferenceStatus: SensitivePreferenceStatus = 'resolved',
): boolean {
  if (sensitivePreferenceStatus === 'pending') return false
  return !hideSensitive
}

export type SensitiveMutationQueue = (
  entity: EntityKind,
  type: OpType,
  targetId: string,
  payload?: OutboxPayload,
  isUndo?: boolean,
) => boolean

export function createSensitiveMutationQueue(
  guardSensitive: () => boolean,
  enqueue: (entity: EntityKind, type: OpType, targetId: string, payload?: OutboxPayload, isUndo?: boolean) => void,
): SensitiveMutationQueue {
  return (entity, type, targetId, payload, isUndo) => {
    if (!guardSensitive()) return false
    enqueue(entity, type, targetId, payload, isUndo)
    return true
  }
}
