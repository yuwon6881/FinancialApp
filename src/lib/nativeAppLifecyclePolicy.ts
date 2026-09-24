/**
 * Android's passkey provider briefly changes app lifecycle state while its credential sheet is
 * open. Locking during that handoff causes a second, unrelated biometric prompt after the
 * passkey succeeds.
 */
export function shouldLockNativeAppForStateChange(isActive: boolean, webAuthnRequestActive: boolean): boolean {
  return !isActive && !webAuthnRequestActive
}
