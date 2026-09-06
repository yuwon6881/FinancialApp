import { SCAN_UPLOADS_STORE, hasLocalFileStorage, requestResult, withStore } from './localFileStore'

export type ScanUploadKind = 'receipt' | 'receipt-split' | 'investment'

export interface PendingScanUpload {
  uploadId: string
  kind: ScanUploadKind
  blob: Blob
  fileName: string
  fileType: string
  createdAt: number
}

/**
 * How long a picked-but-unsent image is worth keeping. Matched to the server's own terminal job
 * retention: a scan started later than this would be pruned before its result could be read, so
 * holding the bytes past it only costs the user storage.
 */
export const PENDING_SCAN_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Whether a queued image has outlived its usefulness. Exported so the rule can be tested without
 * standing up a database: the ordering and pruning below are the whole of the queue's policy.
 */
export function isExpiredScanUpload(record: Pick<PendingScanUpload, 'createdAt'>, now: number): boolean {
  return now - record.createdAt > PENDING_SCAN_UPLOAD_TTL_MS
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
  return bestEffort(async () => {
    await withStore(SCAN_UPLOADS_STORE, 'readwrite', async store => {
      await requestResult(store.put(record))
    })
    return true
  }, false, 'save a pending scan upload')
}

export async function deletePendingScanUpload(uploadId: string): Promise<void> {
  await bestEffort(async () => {
    await withStore(SCAN_UPLOADS_STORE, 'readwrite', async store => {
      await requestResult(store.delete(uploadId))
    })
  }, undefined, 'delete a pending scan upload')
}

/**
 * Every upload still owed, oldest first, with anything past its useful life dropped on the way
 * out. Order matters: a queue drained newest-first would keep re-sending the same fresh image
 * while an older one aged out unsent.
 */
export async function listPendingScanUploads(now = Date.now()): Promise<PendingScanUpload[]> {
  return bestEffort(async () => {
    const stored = await withStore(SCAN_UPLOADS_STORE, 'readonly', store =>
      requestResult(store.getAll()) as Promise<PendingScanUpload[]>)
    const live: PendingScanUpload[] = []
    const expired: string[] = []
    for (const record of stored) {
      if (isExpiredScanUpload(record, now)) expired.push(record.uploadId)
      else live.push(record)
    }
    for (const uploadId of expired) await deletePendingScanUpload(uploadId)
    return live.sort((left, right) => left.createdAt - right.createdAt)
  }, [], 'read pending scan uploads')
}

export async function clearPendingScanUploads(): Promise<void> {
  await bestEffort(async () => {
    await withStore(SCAN_UPLOADS_STORE, 'readwrite', async store => {
      await requestResult(store.clear())
    })
  }, undefined, 'clear pending scan uploads')
}
