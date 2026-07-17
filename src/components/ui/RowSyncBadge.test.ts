import { describe, it, expect } from 'vitest'
import { resolveRowSyncState } from './RowSyncBadge'

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

  it('renders nothing when the row is idle', () => {
    expect(resolveRowSyncState({})).toBeNull()
    expect(resolveRowSyncState({ isDeleting: false, isSyncing: false, isPending: false })).toBeNull()
  })
})
