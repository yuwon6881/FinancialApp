import { describe, it, expect } from 'vitest'
import { mutationBusyLabel, resolveMutationBusyLabel, resolveRowSyncState } from './rowSyncState'

// Pins the one rule every view must agree on: a row that is both deleting AND
// syncing (true during a delete's dispatch, when activeSyncId === row id and
// isPendingDelete is set) must read "Deleting…", never "Syncing…". Settings once
// showed "Syncing…" then "Deleting…" because its call site inlined the opposite
// order; routing every view through resolveRowSyncState makes that unrepresentable.
describe('resolveRowSyncState', () => {
  it('prefers deleting over syncing and pending', () => {
    expect(resolveRowSyncState({ isDeleting: true, isSyncing: true, isPending: true })).toBe('deleting')
  })

  it('prefers syncing over pending', () => {
    expect(resolveRowSyncState({ isSyncing: true, isPending: true })).toBe('syncing')
  })

  it('falls back to pending when only queued offline', () => {
    expect(resolveRowSyncState({ isPending: true })).toBe('pending')
  })

  it('shows a failed mutation ahead of an unsent pending marker', () => {
    expect(resolveRowSyncState({ isFailed: true, isPending: true })).toBe('failed')
  })

  it('renders nothing when the row is idle', () => {
    expect(resolveRowSyncState({})).toBeNull()
    expect(resolveRowSyncState({ isDeleting: false, isSyncing: false, isPending: false })).toBeNull()
  })
})

// The row badge and the list-level summary in Investments once carried separate
// copies of these words, which is how the badge ended up on three periods while
// every other busy label in the app used a single ellipsis character. Both now read
// the same map, so this pins the wording rather than each call site's spelling.
describe('mutation busy vocabulary', () => {
  it('uses one ellipsis character, never three periods', () => {
    for (const state of ['deleting', 'syncing', 'saving', 'undoing'] as const) {
      expect(mutationBusyLabel(state)).toMatch(/…$/)
      expect(mutationBusyLabel(state)).not.toContain('...')
    }
    expect(mutationBusyLabel('pending')).toBe('Pending')
    expect(mutationBusyLabel('failed')).toBe('Failed')
  })

  it('maps an in-flight op type onto the same words the row badge shows', () => {
    expect(resolveMutationBusyLabel('delete')).toBe(mutationBusyLabel('deleting'))
    expect(resolveMutationBusyLabel('restore')).toBe(mutationBusyLabel('undoing'))
    expect(resolveMutationBusyLabel('add')).toBe(mutationBusyLabel('saving'))
    // Every other op type is an in-place change, which reads as a plain sync.
    expect(resolveMutationBusyLabel('update')).toBe(mutationBusyLabel('syncing'))
    expect(resolveMutationBusyLabel('toggle')).toBe(mutationBusyLabel('syncing'))
    expect(resolveMutationBusyLabel('payEarly')).toBe(mutationBusyLabel('syncing'))
  })

  it('reports no label when nothing is in flight', () => {
    expect(resolveMutationBusyLabel(undefined)).toBeNull()
  })
})
