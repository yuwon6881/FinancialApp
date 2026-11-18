const CURRENT_SCAN_JOB_PREFIX = 'ocr-'

/** Every tracked scan list, by its unscoped base key. The local-data wipe removes all of them. */
export const SCAN_JOB_ID_BASE_KEYS = [
  'receipt_scan_job_ids',
  'receipt_split_scan_job_ids',
  'investment_scan_job_ids',
] as const
export type ScanJobIdBaseKey = typeof SCAN_JOB_ID_BASE_KEYS[number]

/**
 * Scan jobs created by the current API are prefixed with `ocr-`. Older builds stored a different
 * id shape in localStorage, and polling those values after an upgrade only produces a noisy 404.
 */
export function isCurrentScanJobId(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(CURRENT_SCAN_JOB_PREFIX)
}

/**
 * Each account tracks its own scans. A shared list let a second account on the same device poll
 * the first account's jobs, get a 404, and drop them from the first account's tracking.
 */
export function scanJobIdsStorageKey(base: ScanJobIdBaseKey, account: string): string {
  return `${base}:${account.trim().toLowerCase()}`
}

function parseIds(raw: string | null): { ids: string[]; dirty: boolean } {
  const parsed: unknown = JSON.parse(raw || '[]')
  if (!Array.isArray(parsed)) return { ids: [], dirty: true }
  const ids = parsed.filter(isCurrentScanJobId)
  return { ids, dirty: ids.length !== parsed.length }
}

export function readStoredScanJobIds(base: ScanJobIdBaseKey, account: string): string[] {
  const key = scanJobIdsStorageKey(base, account)
  try {
    let raw = localStorage.getItem(key)
    let adoptedLegacy = false
    // Builds before per-account scoping wrote one shared list. Whoever signs in first adopts it,
    // once, so a scan that was in flight across the upgrade is not stranded.
    if (raw === null) {
      raw = localStorage.getItem(base)
      adoptedLegacy = raw !== null
    }
    const { ids, dirty } = parseIds(raw)
    if (dirty || adoptedLegacy) {
      try {
        localStorage.setItem(key, JSON.stringify(ids))
        if (adoptedLegacy) localStorage.removeItem(base)
      } catch {
        // Keep polling valid jobs even when local storage cannot be rewritten.
      }
    }
    return ids
  } catch {
    return []
  }
}

/** Every stored scan list for every account, plus the legacy shared ones. */
export function allScanJobIdsStorageKeys(): string[] {
  const keys: string[] = [...SCAN_JOB_ID_BASE_KEYS]
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (key && SCAN_JOB_ID_BASE_KEYS.some(base => key.startsWith(`${base}:`))) keys.push(key)
  }
  return keys
}
