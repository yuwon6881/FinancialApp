import { Haptics, ImpactStyle } from '@capacitor/haptics'

/**
 * Fire a short haptic/vibration pulse.
 *
 * Strategy (in priority order):
 *  1. Capacitor Haptics plugin  — works natively on Android/iOS regardless of
 *     browser vibration permissions (used when running inside the Capacitor
 *     WebView or any PWA wrapper that exposes the plugin bridge).
 *  2. navigator.vibrate()       — Web Vibration API, available on Chrome/Edge
 *     for Android but intentionally disabled on Firefox mobile (privacy).
 *
 * Both paths are no-ops when unsupported; failures are always swallowed.
 *
 * @param pattern  Duration in ms, or an array of [vibrate, pause, vibrate…].
 *                 Mapped to the closest Capacitor ImpactStyle when using the
 *                 native path (Light ≤ 15 ms, Medium ≤ 30 ms, Heavy > 30 ms).
 */
export async function triggerHaptic(pattern: number | number[] = 12): Promise<void> {
  // ── 1. Capacitor native haptics (preferred) ───────────────────────────────
  try {
    const duration = Array.isArray(pattern) ? pattern[0] : pattern
    const style =
      duration <= 15 ? ImpactStyle.Light :
      duration <= 30 ? ImpactStyle.Medium :
                       ImpactStyle.Heavy

    await Haptics.impact({ style })
    return // success — no need for the Web API fallback
  } catch {
    // Plugin not available (e.g. plain desktop browser) — fall through
  }

  // ── 2. Web Vibration API fallback ─────────────────────────────────────────
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern)
    } catch {
      /* vibration not permitted / unsupported — ignore */
    }
  }
}
