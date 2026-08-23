import type { EntityKind } from './outbox'

/**
 * Entities whose primary key the server assigns, so an optimistic row carries only a
 * local placeholder id until its `add` comes back. Every one of these must have that
 * placeholder remapped on success or later ops in the queue dispatch against an id the
 * server has never seen. Client-authored ids (transactions, investments, categories)
 * are already final and need no remap — do not add them here.
 */
export const SERVER_ASSIGNED_ID_ENTITIES: ReadonlySet<EntityKind> = new Set<EntityKind>([
  'wishlistItem',
  'savingsGoal',
  'taxReliefCategory',
])

export const MAX_RETRIES = 5
export const AUTH_RACE_BACKOFF_MS = 3000
/** First wait after any retryable failure; also the base of the escalation curve. */
export const SERVER_WAKE_BACKOFF_MS = 15000
/** Ceiling for the escalating wait. A dead backend is then polled twice a minute, not four times. */
export const MAX_SYNC_BACKOFF_MS = 120000
/** Fraction of the computed wait spread randomly, so many clients do not retry in lockstep. */
export const BACKOFF_JITTER_RATIO = 0.25

/**
 * Statuses in the 4xx range that are **not** a verdict on the request. 429 is the server
 * asking for a slower client, and 408/425 are the request never being read — replaying any
 * of them can succeed unchanged, so they must not be discarded as permanent validation
 * failures the way a 400 or a 422 is.
 */
export const RETRYABLE_CLIENT_STATUSES: ReadonlySet<number> = new Set([408, 425, 429])

/**
 * Escalating wait for a failure that says nothing about the validity of the change.
 *
 * `attempt` counts *consecutive* backoff-inducing failures in this sync session, not the
 * op's retry budget: connection loss and service-wake responses deliberately never consume
 * that budget, so a flat wait meant an unreachable or permanently-failing backend was polled
 * every 15s forever. The first wait stays at the base so an ordinary Cloud Run cold start is
 * still covered promptly; only a failure that repeats starts backing away.
 *
 * A server-sent `Retry-After` wins outright — it is the only figure that knows when the next
 * attempt can succeed — but is still clamped to the same ceiling so a hostile or mistaken
 * header cannot strand queued changes.
 */
export function computeBackoffMs(
  attempt: number,
  retryAfterMs?: number,
  random: () => number = Math.random,
): number {
  if (retryAfterMs !== undefined) {
    return Math.min(Math.max(retryAfterMs, 1000), MAX_SYNC_BACKOFF_MS)
  }
  if (attempt <= 0) return SERVER_WAKE_BACKOFF_MS
  const escalated = Math.min(SERVER_WAKE_BACKOFF_MS * 2 ** attempt, MAX_SYNC_BACKOFF_MS)
  const jitter = escalated * BACKOFF_JITTER_RATIO * (random() * 2 - 1)
  return Math.max(SERVER_WAKE_BACKOFF_MS, Math.round(escalated + jitter))
}
