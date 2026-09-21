import { SCAN_UPLOADS_STORE, hasLocalFileStorage, requestResult, withStore } from './localFileStore'

export type ScanUploadKind = 'receipt' | 'receipt-split' | 'investment'
export const PENDING_SCAN_UPLOADS_CHANGED_EVENT = 'financialapp:pending-scan-uploads-changed'

export interface PendingScanUpload {
  uploadId: string
  /** Normalized account name that selected this image. Never replay without an exact owner match. */
  ownerId: string
  kind: ScanUploadKind
  blob: Blob
  fileName: string
  fileType: string
  createdAt: number
}

export function normalizeScanUploadOwner(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase()
  return normalized || null
}

/** The authenticated account name is set with the FinancialApp session, including cookie sessions. */
export function getCurrentScanUploadOwner(): string | null {
  try {
    return typeof globalThis.localStorage === 'undefined'
      ? null
      : normalizeScanUploadOwner(globalThis.localStorage.getItem('auth_username'))
  } catch {
    return null
  }
}

export function filterScanUploadsForOwner(
  records: readonly PendingScanUpload[],
  ownerId: string,
): PendingScanUpload[] {
  const owner = normalizeScanUploadOwner(ownerId)
  if (!owner) return []
  return records.filter(record => normalizeScanUploadOwner(record.ownerId) === owner)
}

export function sortPendingScanUploadsForOwner(
  records: readonly PendingScanUpload[],
  ownerId: string,
): PendingScanUpload[] {
  return filterScanUploadsForOwner(records, ownerId).sort((left, right) => left.createdAt - right.createdAt)
}

function announcePendingScanUploadsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PENDING_SCAN_UPLOADS_CHANGED_EVENT))
  }
}

/**
 * Images picked for a scan whose upload has not been accepted yet.
 *
 * Every operation here is best-effort and never throws: a browser with no IndexedDB (private
 * windows, blocked site data) must still be able to scan a receipt the ordinary way. Failing to
 * persist costs the retry-after-relaunch guarantee, not the upload.
 */
async function bestEffort<T>(action: () => Promise<T>, fallback: T, what: string): Promise<T> {
  if (!hasLocalFileStorage()) return fallback
  try {
    return await action()
  } catch (error) {
    console.warn(`Failed to ${what}`, error)
    return fallback
  }
}

export async function savePendingScanUpload(record: PendingScanUpload): Promise<boolean> {
  const saved = await bestEffort(async () => {
    await withStore(SCAN_UPLOADS_STORE, 'readwrite', async store => {
      await requestResult(store.put(record))
    })
    return true
  }, false, 'save a pending scan upload')
  if (saved) announcePendingScanUploadsChanged()
  return saved
}

export async function deletePendingScanUpload(uploadId: string): Promise<void> {
  await bestEffort(async () => {
    await withStore(SCAN_UPLOADS_STORE, 'readwrite', async store => {
      await requestResult(store.delete(uploadId))
    })
  }, undefined, 'delete a pending scan upload')
  announcePendingScanUploadsChanged()
}

/**
 * Count retained images without reading their potentially multi-megabyte blobs into memory.
 * `null` means this browser could not report the queue, so the UI must not show an all-clear.
 */
/** Pass no owner only for the explicit whole-device local-data wipe confirmation. */
export async function countStoredScanUploads(ownerId?: string): Promise<number | null> {
  if (!hasLocalFileStorage()) return null
  try {
    return await withStore(SCAN_UPLOADS_STORE, 'readonly', store => {
      if (ownerId === undefined) return requestResult(store.count()) as Promise<number>
      const owner = normalizeScanUploadOwner(ownerId)
      return owner
        ? requestResult(store.index('ownerId').count(owner)) as Promise<number>
        : Promise.resolve(0)
    })
  } catch (error) {
    console.warn('Could not count saved scan uploads', error)
    return null
  }
}

/**
 * Every upload still owed, oldest first. Unresolved uploads never expire automatically; the
 * browser retains them until the server accepts the upload or the user deliberately clears local
 * data.
 */
export async function listPendingScanUploads(ownerId: string): Promise<PendingScanUpload[]> {
  const owner = normalizeScanUploadOwner(ownerId)
  if (!owner) return []
  return bestEffort(async () => {
    const stored = await withStore(SCAN_UPLOADS_STORE, 'readonly', store =>
      requestResult(store.index('ownerId').getAll(owner)) as Promise<PendingScanUpload[]>)
    return sortPendingScanUploadsForOwner(stored, owner)
  }, [], 'read pending scan uploads')
}

export async function clearPendingScanUploads(): Promise<void> {
  await bestEffort(async () => {
    await withStore(SCAN_UPLOADS_STORE, 'readwrite', async store => {
      await requestResult(store.clear())
    })
  }, undefined, 'clear pending scan uploads')
  announcePendingScanUploadsChanged()
}
