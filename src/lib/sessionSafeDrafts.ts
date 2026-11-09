import { useSyncExternalStore } from 'react'

/**
 * Tracks drafts created or captured during the current unrevealed/pre-wake browser session.
 * Persisted prior-session drafts keep their amounts hidden in `TransactionFormSheet` until
 * sensitive data is revealed, whereas drafts the user just entered may be reviewed and edited.
 */
const safeDraftIds = new Set<string>()
let snapshot: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()

function emitChange() {
  snapshot = new Set(safeDraftIds)
  for (const listener of listeners) listener()
}

export function markSessionSafeDrafts(ids: ReadonlyArray<string>): void {
  let changed = false
  for (const id of ids) {
    if (!id || safeDraftIds.has(id)) continue
    safeDraftIds.add(id)
    changed = true
  }
  if (changed) emitChange()
}

export function isSessionSafeDraft(id: string): boolean {
  return safeDraftIds.has(id)
}

export function clearSessionSafeDrafts(): void {
  if (safeDraftIds.size === 0) return
  safeDraftIds.clear()
  emitChange()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function getSnapshot(): ReadonlySet<string> {
  return snapshot
}

export function useSessionSafeDraftIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
