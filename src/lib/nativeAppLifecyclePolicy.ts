/**
 * Android's passkey provider briefly changes app lifecycle state while its credential sheet is
 * open. Locking during that handoff causes a second, unrelated biometric prompt after the
 * passkey succeeds.
 */
export function shouldLockNativeAppForStateChange(isActive: boolean, webAuthnRequestActive: boolean): boolean {
  return !isActive && !webAuthnRequestActive
}

/** A background transition must never launch Android authentication over another app. */
export class NativeAppResumeLock {
  private pending = false
  onStateChange(isActive: boolean, webAuthnRequestActive: boolean): boolean {
    if (!isActive) {
      this.pending ||= shouldLockNativeAppForStateChange(false, webAuthnRequestActive)
      return false
    }
    const lock = this.pending
    this.pending = false
    return lock
  }
}
