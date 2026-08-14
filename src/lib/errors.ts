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

export function isLockError(err: unknown): boolean {
  return hasHttpStatus(err, 423)
}
