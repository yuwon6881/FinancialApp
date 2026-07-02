/**
 * Fire a short haptic pulse where the device supports it (no-op elsewhere).
 * Safe to call from anywhere — failures are swallowed.
 */
export function triggerHaptic(pattern: number | number[] = 12): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern)
    } catch {
      /* vibration not permitted / unsupported — ignore */
    }
  }
}
