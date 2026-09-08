import { apiFetch, throwApiError } from './client'
import { getStatus } from '../errors'
import { isNetworkFailure, isServiceWakeFailure } from '../outboxDrainHelpers'
import {
  deletePendingScanUpload,
  listPendingScanUploads,
  savePendingScanUpload,
  type PendingScanUpload,
  type ScanUploadKind,
} from '../scanUploadStore'

export type { ScanUploadKind } from '../scanUploadStore'

/** Mirrors `GcsReceiptImageStore.MaxImageBytes`; the endpoints also cap the request at 11 MiB. */
const MAX_SCAN_IMAGE_BYTES = 10 * 1024 * 1024

const SCAN_ENDPOINTS: Record<ScanUploadKind, string> = {
  receipt: '/ocr/scan-receipt/jobs',
  'receipt-split': '/ocr/scan-receipt-split/jobs',
  investment: '/ocr/scan-investment/jobs',
}

const START_FAILURE_MESSAGES: Record<ScanUploadKind, string> = {
  receipt: 'Could not start receipt scan. Please try again.',
  'receipt-split': 'Could not start receipt split scan. Please try again.',
  investment: 'Could not start investment scan. Please try again.',
}

const QUEUED_MESSAGES: Record<ScanUploadKind, string> = {
  receipt: 'No connection. This receipt is saved and will scan itself once you are back online.',
  'receipt-split': 'No connection. This receipt is saved and will scan itself once you are back online.',
  investment: 'No connection. This statement is saved and will scan itself once you are back online.',
}

/**
 * A camera photo routinely lands well past the 10 MB the scan endpoints accept, and the whole
 * file has to cross a phone connection before the job can even start. Downscale it the way the
 * document vault does, but with a longer edge and less loss, because small print on a receipt is
 * the thing being read. Non-images, already-small files and any decode failure come back
 * untouched, so this can only ever shrink a real photo.
 *
 * What survives compression still has to fit. Rejecting it here keeps the reason truthful: past
 * the request cap the server answers 413 with a non-JSON body, and the generic start-scan
 * fallback would tell the user to try a clearer photo when the problem is the file size.
 */
export async function prepareScanImage(imageFile: File): Promise<File> {
  const { compressImageFile } = await import('../imageCompression')
  const compressed = await compressImageFile(imageFile, { maxEdge: 2400, quality: 0.85 })
  if (compressed.size > MAX_SCAN_IMAGE_BYTES) {
    throw new Error('Receipt image is too large. Please use an image under 10 MB.')
  }
  return compressed
}

async function postScanImage(
  kind: ScanUploadKind,
  image: File,
): Promise<{ scanId: string; status: string }> {
  const formData = new FormData()
  // Appended without an explicit filename on purpose: passing one makes FormData wrap the value
  // in a fresh File. A retried upload rebuilds its File from the stored bytes and name instead,
  // so the part still looks like the file the user picked.
  formData.append('image', image)
  const response = await apiFetch(SCAN_ENDPOINTS[kind], { method: 'POST', body: formData })
  if (!response.ok) await throwApiError(response, START_FAILURE_MESSAGES[kind])
  return response.json()
}

/**
 * Whether the upload is worth keeping for a later attempt.
 *
 * A phone that sleeps, loses signal, or is swiped away mid-upload aborts the request with no
 * response at all, and Cloud Run answers a cold start with a 5xx. None of those say anything about
 * the image. A refusal that does — too large, wrong type, malformed, rate-limited — is the user's
 * to act on now, so the bytes are dropped rather than re-sent on every wake.
 *
 * A locked or expired session counts as retryable: the same image is still wanted the moment the
 * user unlocks, and the queue's own expiry stops a signed-out upload lingering.
 */
function isWorthRetrying(error: unknown, online: boolean): boolean {
  const status = getStatus(error)
  if (status === undefined) return isNetworkFailure(error, online)
  if (status === 0) return true
  if (status === 401 || status === 423) return true
  return isServiceWakeFailure(status) || status >= 500
}

function newUploadId(): string {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Start a scan, keeping the picked image until the server has accepted it.
 *
 * The upload is the fragile half of scanning: once a job id exists the result survives anything,
 * because the work is server-side and the id is persisted — but the seconds spent pushing a
 * multi-megabyte photo up a phone connection are exactly when a PWA gets suspended, backgrounded
 * or killed, and the bytes only ever lived in a closure. Writing them down first turns that from
 * silent loss into a retry.
 *
 * The in-memory image is what gets posted, never a copy read back out of storage, so the happy
 * path costs one extra write and no extra decode.
 */
export async function startScanUpload(
  kind: ScanUploadKind,
  imageFile: File,
): Promise<{ scanId: string; status: string }> {
  const image = await prepareScanImage(imageFile)
  const record: PendingScanUpload = {
    uploadId: newUploadId(),
    kind,
    blob: image,
    fileName: image.name || imageFile.name || 'receipt',
    fileType: image.type || imageFile.type,
    createdAt: Date.now(),
  }
  const persisted = await savePendingScanUpload(record)

  try {
    const started = await postScanImage(kind, image)
    await deletePendingScanUpload(record.uploadId)
    return started
  } catch (error: unknown) {
    const online = typeof navigator === 'undefined' || navigator.onLine
    if (!persisted || !isWorthRetrying(error, online)) {
      await deletePendingScanUpload(record.uploadId)
      throw error
    }
    // Held for the next wake-up. Said plainly, because the raw failure here is a browser's
    // "Failed to fetch" and the picker's fallback blames the photo.
    throw new Error(QUEUED_MESSAGES[kind], { cause: error })
  }
}

export interface DrainedScanUpload {
  kind: ScanUploadKind
  scanId: string
}

export interface ScanUploadDrainResult {
  started: DrainedScanUpload[]
  /** Uploads the server refused outright, so the user knows those images are not coming back. */
  discarded: ScanUploadKind[]
  remaining: number
}

/**
 * Push everything the queue still owes, oldest first.
 *
 * Stops at the first upload that fails for a reason worth retrying: one dead connection means the
 * next attempt will fail the same way, and draining the rest would burn the user's data allowance
 * re-sending photos that cannot land yet.
 */
export async function drainPendingScanUploads(): Promise<ScanUploadDrainResult> {
  const pending = await listPendingScanUploads()
  const started: DrainedScanUpload[] = []
  const discarded: ScanUploadKind[] = []

  for (const record of pending) {
    const image = new File([record.blob], record.fileName, { type: record.fileType || record.blob.type })
    try {
      const result = await postScanImage(record.kind, image)
      await deletePendingScanUpload(record.uploadId)
      started.push({ kind: record.kind, scanId: result.scanId })
    } catch (error: unknown) {
      const online = typeof navigator === 'undefined' || navigator.onLine
      // Left exactly as it is: the record is already stored, and the next wake-up tries again.
      if (isWorthRetrying(error, online)) break
      await deletePendingScanUpload(record.uploadId)
      discarded.push(record.kind)
    }
  }

  return { started, discarded, remaining: pending.length - started.length - discarded.length }
}
