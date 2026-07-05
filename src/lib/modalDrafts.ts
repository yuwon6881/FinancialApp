// Backing store for useFormDraft (see useFormDraft.ts). All in-progress modal
// field values live in a single localStorage blob keyed by modalId, so the
// auth flow (App.tsx) can back up/restore ALL of them generically without
// knowing which modals exist -- a new modal that adopts useFormDraft is
// covered automatically, no changes needed here or in App.tsx.
const STORAGE_KEY = 'modal_drafts'
const BACKUP_KEY = 'modal_drafts_backup'

type DraftMap = Record<string, unknown>

function readAll(): DraftMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeAll(map: DraftMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function getModalDraft<T>(modalId: string): T | undefined {
  return readAll()[modalId] as T | undefined
}

export function setModalDraft<T>(modalId: string, value: T): void {
  const all = readAll()
  all[modalId] = value
  writeAll(all)
}

export function clearModalDraft(modalId: string): void {
  const all = readAll()
  if (!(modalId in all)) return
  delete all[modalId]
  writeAll(all)
}

// Called from App.tsx's handleLogout/handleLoginSuccess, exactly like the
// pending-ops/draft-transactions/failed-ops backups -- owner-tagged so a
// different user logging in on the same device never sees someone else's
// half-typed form.
export function backupModalDraftsOnLogout(owner: string): void {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw || raw === '{}') return
  localStorage.setItem(BACKUP_KEY, JSON.stringify({ owner, raw }))
}

export function restoreModalDraftsOnLogin(newUsername: string): void {
  const backupRaw = localStorage.getItem(BACKUP_KEY)
  if (!backupRaw) return
  try {
    const parsed = JSON.parse(backupRaw)
    if (parsed && parsed.owner === newUsername && typeof parsed.raw === 'string') {
      localStorage.setItem(STORAGE_KEY, parsed.raw)
    }
  } catch (e) {
    console.error('Failed to parse backed up modal drafts:', e)
  }
  localStorage.removeItem(BACKUP_KEY)
}

export function clearAllModalDrafts(): void {
  localStorage.removeItem(STORAGE_KEY)
}
