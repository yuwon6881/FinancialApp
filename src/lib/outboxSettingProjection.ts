import type { FinancialSetting } from '../types'
import type { OutboxPayload, QueuedOp } from './outboxTypes'

/**
 * A queued setting preference is the user's newest choice and must win over a
 * dashboard response that may have started before that write reached the
 * server. This is especially important during PWA startup, where the dashboard
 * refresh and outbox replay run concurrently.
 */
export function projectSettingPreference<T>(key: keyof OutboxPayload, serverValue: T, ops: ReadonlyArray<QueuedOp>): T {
  const latestPreferenceOp = ops.reduce<QueuedOp | undefined>((latest, op) => {
    if (op.entity !== 'settings' || op.type !== 'update') {
      return latest
    }
    const hasValue = op.targetId === key || (op.payload && op.payload[key] !== undefined)
    if (!hasValue) {
      return latest
    }
    return !latest || op.createdAt >= latest.createdAt ? op : latest
  }, undefined)

  return latestPreferenceOp && latestPreferenceOp.payload && latestPreferenceOp.payload[key] !== undefined
    ? latestPreferenceOp.payload[key] as T
    : serverValue
}

/**
 * Reconciles a server settings snapshot with setting writes that were queued
 * after that request began. This prevents a late startup response from
 * restoring stale preferences in React state or the local cache.
 */
export function projectFinancialSetting(
  serverSetting: FinancialSetting,
  ops: ReadonlyArray<QueuedOp>,
): FinancialSetting {
  return [...ops]
    .filter(op => op.entity === 'settings' && op.type === 'update' && op.payload)
    .sort((left, right) => left.createdAt - right.createdAt)
    .reduce<FinancialSetting>((setting, op) => {
      if (op.targetId === 'summarySeen') {
        return typeof op.payload?.cycleKey === 'string'
          ? { ...setting, lastSummaryCycleSeen: op.payload.cycleKey }
          : setting
      }

      return { ...setting, ...op.payload } as FinancialSetting
    }, { ...serverSetting })
}
