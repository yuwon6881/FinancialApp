export function getErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function getErrorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined
}

export function errorMessageIncludes(error: unknown, text: string): boolean {
  return getErrorMessage(error, '').includes(text)
}

export function errorMessageIncludesLower(error: unknown, text: string): boolean {
  return getErrorMessage(error, '').toLowerCase().includes(text.toLowerCase())
}

/**
 * Grace window after a fresh login/unlock during which a 401 is treated as a
 * race against the new session rather than a genuine auth failure.
 */
export const JUST_LOGGED_IN_WINDOW_MS = 10000

export function getStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object' || !('status' in err)) return undefined
  return typeof err.status === 'number' && Number.isFinite(err.status) ? err.status : undefined
}

/**
 * The wait an `ApiError` carried from the server's `Retry-After`. Non-finite or
 * negative values are ignored so a malformed header cannot pin a retry open.
 */
export function getRetryAfterMs(err: unknown): number | undefined {
  if (!err || typeof err !== 'object' || !('retryAfterMs' in err)) return undefined
  const value = err.retryAfterMs
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/**
 * The server's machine-readable refusal code, when it sent one. Read structurally rather than by
 * `instanceof ApiError` so the outbox's injected fakes and a replayed/serialized error answer too.
 */
export function getErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object' || !('code' in err)) return undefined
  return typeof err.code === 'string' && err.code ? err.code : undefined
}

/**
 * Marks a 423 answered to a request that left before the session was unlocked. See
 * lib/api/client for why an in-flight lock and an unlock can cross.
 */
export const STALE_LOCK_CODE = 'stale_session_lock'

/**
 * Whether a refusal is "this row needs a live account named" rather than an ordinary rejection.
 * Both codes are actionable by the same fix, which is why they collapse to one question here: a
 * required account and an invalid one are answered by choosing an open account in the bucket.
 */
export function isLedgerAccountRefusal(err: unknown): boolean {
  const code = getErrorCode(err)
  return code === 'ledger_account_required' || code === 'ledger_account_invalid'
}

/** The buckets a `ledger_account_*` refusal named, so the fix can say which are missing. */
export function getMissingBuckets(err: unknown): string[] | undefined {
  if (!err || typeof err !== 'object' || !('missingBuckets' in err)) return undefined
  const value = err.missingBuckets
  if (!Array.isArray(value)) return undefined
  const buckets = value.filter((bucket): bucket is string => typeof bucket === 'string' && bucket !== '')
  return buckets.length > 0 ? buckets : undefined
}

export function hasHttpStatus(err: unknown, expected: number): boolean {
  const status = getStatus(err)
  if (status !== undefined) return status === expected
  return errorMessageIncludes(err, String(expected))
}

/** A real HTTP status always wins over message sniffing. */
export function isAuthError(err: unknown): boolean {
  return hasHttpStatus(err, 401)
    || (getStatus(err) === undefined && errorMessageIncludesLower(err, 'unauthorized'))
}

/**
 * A 423 answered to a request that left before the session was unlocked describes a lock that no
 * longer exists. Treating it as a live lock re-locked the app moments after a successful unlock.
 */
export function isLockError(err: unknown): boolean {
  return hasHttpStatus(err, 423) && getErrorCode(err) !== STALE_LOCK_CODE
}
