import { getErrorMessage, getErrorName } from '../errors'
import {
  PUSH_DENIED_GUIDANCE,
  PUSH_NOT_CONFIGURED_GUIDANCE,
  PUSH_OFFLINE_GUIDANCE,
  PUSH_SERVICE_BLOCKED_GUIDANCE,
  PUSH_STORAGE_BLOCKED_GUIDANCE,
  PUSH_UNSUPPORTED_GUIDANCE,
  pushUnknownFailureGuidance,
} from './messages'

/**
 * Why this device could not be enrolled for push. The whole point of naming these is that the
 * remedies are different and only one of them is "your browser cannot do this": a browser that
 * refuses to register with its push service, or that will not let the site keep local data, is
 * fully capable and one setting away from working. Reporting every failure as "unsupported" sent
 * people to look for a different browser instead of the switch that was actually off.
 */
export type PushFailureReason =
  | 'unsupported'
  | 'notConfigured'
  | 'permissionBlocked'
  | 'pushServiceBlocked'
  | 'storageBlocked'
  | 'offline'
  | 'unknown'

/** A push enrolment failure that already knows which remedy to offer. */
export class PushTokenError extends Error {
  readonly reason: PushFailureReason
  /** Underlying code/name, kept for the operator-facing tail of the unknown message. */
  readonly detail: string | undefined

  constructor(reason: PushFailureReason, message: string, options?: { cause?: unknown; detail?: string }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'PushTokenError'
    this.reason = reason
    this.detail = options?.detail
  }
}

function firebaseErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined
  const code = (error as { code: unknown }).code
  return typeof code === 'string' && code.startsWith('messaging/') ? code : undefined
}

/** The short technical token shown to the user only in the last-resort message. */
export function pushFailureDetail(error: unknown): string | undefined {
  return firebaseErrorCode(error) ?? getErrorName(error)
}

export function classifyPushTokenError(error: unknown): PushFailureReason {
  if (error instanceof PushTokenError) return error.reason

  const code = firebaseErrorCode(error)
  const name = getErrorName(error)

  if (code === 'messaging/permission-blocked' || name === 'NotAllowedError') return 'permissionBlocked'
  if (code === 'messaging/indexed-db-unsupported') return 'storageBlocked'
  if (code === 'messaging/unsupported-browser' || name === 'NotSupportedError') return 'unsupported'

  // Chromium hands back a bare `AbortError: Registration failed - push service error` when the
  // browser declines to talk to its push service at all. Brave gates that behind "Use Google
  // services for push messaging", so an install that worked before an update can start failing
  // here with notification permission still granted.
  if (name === 'AbortError') return 'pushServiceBlocked'
  if (code === 'messaging/token-subscribe-failed' || code === 'messaging/token-subscribe-no-token') {
    return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'pushServiceBlocked'
  }
  if (code === 'messaging/failed-service-worker-registration') return 'unsupported'

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline'
  if (name === 'TypeError' && /fetch|network/i.test(getErrorMessage(error, ''))) return 'offline'

  return 'unknown'
}

/** The one message that answers this reason, and never a different browser's problem. */
export function pushFailureGuidance(reason: PushFailureReason, detail?: string): string {
  switch (reason) {
    case 'unsupported': return PUSH_UNSUPPORTED_GUIDANCE
    case 'notConfigured': return PUSH_NOT_CONFIGURED_GUIDANCE
    case 'permissionBlocked': return PUSH_DENIED_GUIDANCE
    case 'pushServiceBlocked': return PUSH_SERVICE_BLOCKED_GUIDANCE
    case 'storageBlocked': return PUSH_STORAGE_BLOCKED_GUIDANCE
    case 'offline': return PUSH_OFFLINE_GUIDANCE
    case 'unknown': return pushUnknownFailureGuidance(detail)
  }
}

/** Guidance for whatever a token request threw, without the caller naming the reason itself. */
export function pushErrorGuidance(error: unknown): string {
  const detail = error instanceof PushTokenError ? error.detail : pushFailureDetail(error)
  return pushFailureGuidance(classifyPushTokenError(error), detail)
}
