const CURRENT_SCAN_JOB_PREFIX = 'ocr-'

/**
 * Scan jobs created by the current API are prefixed with `ocr-`. Older builds stored a different
 * id shape in localStorage, and polling those values after an upgrade only produces a noisy 404.
 */
export function isCurrentScanJobId(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(CURRENT_SCAN_JOB_PREFIX)
}

export function readStoredScanJobIds(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) || '[]')
    if (!Array.isArray(parsed)) return []

    const ids = parsed.filter(isCurrentScanJobId)
    if (ids.length !== parsed.length) {
      try {
        localStorage.setItem(key, JSON.stringify(ids))
      } catch {
        // Keep polling valid jobs even when local storage cannot be rewritten.
      }
    }
    return ids
  } catch {
    return []
  }
}
