/**
 * Bounded retry for the readiness probes that decide whether device unlock can be offered.
 *
 * Cloud Run scales to zero, so the first requests after the app has been closed for a while can
 * fail outright while the container is still starting. The fingerprint affordances were decided by
 * probes that ran exactly once, so a probe lost to that cold start hid the device-unlock button --
 * and left its WebAuthn challenge unfetched -- for the rest of the session, leaving the password as
 * the only way back in. Retrying costs nothing once the server answers: the first answer ends the
 * loop, and only an unanswered probe is repeated.
 */

/**
 * Waits before each retry. Short at first because the user is standing in front of it, then long
 * enough to still be waiting when a slow cold start finally finishes (~53s of cover in total).
 */
const SERVER_WAKE_PROBE_DELAYS_MS: readonly number[] = [500, 1500, 3000, 6000, 12000, 15000, 15000]

/**
 * Runs `probe` until it reports there is nothing left to retry, or the delay curve runs out.
 *
 * `probe` resolves true when it has its answer -- including a final "no" -- and false when the
 * server did not answer at all. A rejection counts as no answer. The returned function cancels a
 * pending wait; callers must call it from their effect cleanup so a wait cannot outlive them.
 */
export function retryWhileServerWakes(
  probe: () => Promise<boolean>,
  delaysMs: readonly number[] = SERVER_WAKE_PROBE_DELAYS_MS,
): () => void {
  let stopped = false
  let inFlight = false
  let attempt = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const stop = () => {
    stopped = true
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    window.removeEventListener('online', onOnline)
  }

  const schedule = () => {
    if (stopped || attempt >= delaysMs.length) return
    timer = setTimeout(() => void run(), delaysMs[attempt++])
  }

  const run = async () => {
    timer = null
    if (stopped || inFlight) return
    inFlight = true
    let answered: boolean
    try {
      answered = await probe()
    } catch {
      answered = false
    }
    inFlight = false
    if (stopped) return
    if (answered) stop()
    else schedule()
  }

  // Reconnecting is worth more than the curve: a probe that failed only because the device was
  // offline can succeed immediately, and should not sit out a wait scheduled while there was no
  // network at all.
  function onOnline() {
    if (stopped) return
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    attempt = 0
    void run()
  }

  window.addEventListener('online', onOnline)
  void run()

  return stop
}
