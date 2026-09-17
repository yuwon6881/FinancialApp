import { Input } from './ui/Input'
import { useState, useEffect, useId, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ShieldCheck } from 'lucide-react'
import * as api from '../lib/api'
import { AppLogo } from './ui/AppLogo'
import { isPlatformAuthenticatorAvailable, getFingerprintAssertion } from '../lib/webauthn'
import {
  clearCachedFingerprintAssertOptions,
  getCachedFingerprintAssertOptions,
  prefetchFingerprintAssertOptions,
} from '../lib/fingerprintOptionsCache'
import { getErrorMessage, getStatus } from '../lib/errors'
import { AlertBanner } from './ui/AlertBanner'
import { Button } from './ui/Button'
import { Z_LAYERS } from '../lib/zLayers'
import { FormField } from './ui/FormField'
import { focusFirstInvalidField } from './ui/formValidation'
import { useDialog } from '../lib/useDialog'
import { rememberDeviceUnlockCredential } from '../lib/deviceUnlockRegistration'
import { retryWhileServerWakes } from '../lib/serverWakeRetry'
import { isAndroidInstalledMobilePwa } from '../lib/mobilePwaDeviceGateEligibility'

type LockScreenMode = 'session-timeout' | 'pwa-launch'

export const AUTOMATIC_DEVICE_UNLOCK_TIMEOUT_MS = 15_000

interface LockScreenProps {
  mode?: LockScreenMode
  isOpen: boolean
  username: string
  onTryDeviceUnlock?: (signal?: AbortSignal) => Promise<void>
  onUnlocked: () => void
  onSignOut: () => void
}

export function LockScreen({
  mode = 'session-timeout',
  isOpen,
  username,
  onTryDeviceUnlock,
  onUnlocked,
  onSignOut,
}: LockScreenProps) {
  const [lockPassword, setLockPassword] = useState('')
  const [lockError, setLockError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordVerifying, setPasswordVerifying] = useState(false)
  const [fingerprintVerifying, setFingerprintVerifying] = useState(false)
  const [fingerprintAvailable, setFingerprintAvailable] = useState(false)
  const [hasAttemptedDeviceUnlock, setHasAttemptedDeviceUnlock] = useState(false)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const automaticLaunchAttemptRef = useRef(false)
  const deviceAttemptAbortRef = useRef<AbortController | null>(null)
  const deviceAttemptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lifecycleTokenRef = useRef<object | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useDialog({
    isOpen,
    onClose: () => undefined,
    ref: panelRef,
    canClose: () => false,
  })

  const cancelDeviceAttempt = useCallback(() => {
    if (deviceAttemptTimeoutRef.current !== null) {
      clearTimeout(deviceAttemptTimeoutRef.current)
      deviceAttemptTimeoutRef.current = null
    }
    deviceAttemptAbortRef.current?.abort()
    deviceAttemptAbortRef.current = null
  }, [])

  useEffect(() => {
    // React Strict Mode rehearses an effect cleanup/setup pair without actually unmounting the
    // screen. Defer cancellation one microtask so that rehearsal does not kill the one automatic
    // Android prompt; a real unmount has no replacement setup and still cancels the request.
    const lifecycleToken = {}
    lifecycleTokenRef.current = lifecycleToken
    return () => {
      queueMicrotask(() => {
        if (lifecycleTokenRef.current === lifecycleToken) cancelDeviceAttempt()
      })
    }
  }, [cancelDeviceAttempt])

  useEffect(() => {
    if (!isOpen) cancelDeviceAttempt()
  }, [cancelDeviceAttempt, isOpen])

  useEffect(() => {
    if (!isOpen) {
      setFingerprintAvailable(false)
      clearCachedFingerprintAssertOptions()
      return
    }

    if (mode === 'pwa-launch') {
      setFingerprintAvailable(true)
      return
    }

    setFingerprintAvailable(false)
    let cancelled = false
    // The lock screen is exactly where a scaled-to-zero backend is most likely to be cold, and
    // asking once meant a lost race hid device unlock for as long as the screen stayed up -- with
    // the password as the only way back in. Keep asking until the server actually answers, and hold
    // the challenge ready so the tap itself never waits on the network.
    const stopProbing = retryWhileServerWakes(async () => {
      const [platformAvailable, status] = await Promise.all([
        isPlatformAuthenticatorAvailable(),
        api.fetchAuthStatus(username).catch(() => null),
      ])
      if (cancelled || !platformAvailable) return true
      if (!status) return false
      if (!status.hasFingerprintOnDevice) return true
      setFingerprintAvailable(true)
      try {
        await prefetchFingerprintAssertOptions()
        return true
      } catch {
        return false
      }
    })

    return () => {
      cancelled = true
      stopProbing()
      clearCachedFingerprintAssertOptions()
    }
  }, [isOpen, mode, username])

  useEffect(() => {
    if (mode !== 'pwa-launch') return
    const online = () => setIsOnline(true)
    const offline = () => setIsOnline(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [mode])

  const handleFingerprintUnlock = useCallback(async (automatic = false) => {
    if (fingerprintVerifying || passwordVerifying) return
    cancelDeviceAttempt()
    const abortController = new AbortController()
    deviceAttemptAbortRef.current = abortController
    let timedOut = false
    if (mode === 'pwa-launch' && automatic) {
      deviceAttemptTimeoutRef.current = setTimeout(() => {
        timedOut = true
        abortController.abort()
      }, AUTOMATIC_DEVICE_UNLOCK_TIMEOUT_MS)
    }
    setHasAttemptedDeviceUnlock(true)
    setFingerprintVerifying(true)
    setLockError(null)
    setPasswordError(null)
    try {
      if (mode === 'pwa-launch') {
        if (!onTryDeviceUnlock) throw new Error('Device unlock is unavailable.')
        await onTryDeviceUnlock(abortController.signal)
        if (abortController.signal.aborted) return
        onUnlocked()
        return
      }
      const { challengeId, options } = await getCachedFingerprintAssertOptions()
      const credential = await getFingerprintAssertion(options, abortController.signal)
      if (abortController.signal.aborted) return
      await api.verifyFingerprintAssert(challengeId, credential)
      if (abortController.signal.aborted) return
      rememberDeviceUnlockCredential(username, credential.id)
      setLockPassword('')
      onUnlocked()
    } catch (err: unknown) {
      // A lifecycle cancellation (unmount or sign-out) should not put an error on a screen that is
      // already going away. Automatic timeout and browser rejection remain visible so the user gets
      // a retry path instead of an endless "Verifying device..." state.
      if (!(abortController.signal.aborted && !timedOut)) {
        console.error(err)
        setLockError(timedOut
          ? 'Device verification timed out. Try again or use your password.'
          : getErrorMessage(err, 'Device verification was cancelled or failed. Try again or use your password.'))
      }
    } finally {
      if (deviceAttemptTimeoutRef.current !== null) {
        clearTimeout(deviceAttemptTimeoutRef.current)
        deviceAttemptTimeoutRef.current = null
      }
      if (deviceAttemptAbortRef.current === abortController) deviceAttemptAbortRef.current = null
      clearCachedFingerprintAssertOptions()
      setFingerprintVerifying(false)
    }
  }, [cancelDeviceAttempt, fingerprintVerifying, mode, onTryDeviceUnlock, onUnlocked, passwordVerifying, username])

  useEffect(() => {
    if (!isOpen || mode !== 'pwa-launch' || automaticLaunchAttemptRef.current) return
    // A cold Android WebAPK launch has no user activation. Some Android/Chrome builds leave a
    // page-load modal WebAuthn request pending without ever opening the sensor, which then blocks
    // the next request. Start the first Android ceremony from the visible button instead; other
    // platforms retain the automatic launch behavior.
    if (isAndroidInstalledMobilePwa()) return
    automaticLaunchAttemptRef.current = true
    void handleFingerprintUnlock(true)
  }, [handleFingerprintUnlock, isOpen, mode])

  const handleSignOut = useCallback(() => {
    cancelDeviceAttempt()
    void onSignOut()
  }, [cancelDeviceAttempt, onSignOut])

  if (!isOpen) return null

  // Rendered through a portal to document.body so the lock overlay is a top-level
  // stacking sibling of every other portal (bottom sheets, modals, the AI chat panel).
  // Mounted inside App's tree its z-index was trapped in a nested stacking context and
  // the sheet portals painted over it; at body level the higher z-index wins, so the
  // lock screen always covers any open modal — and any toast — without having to close
  // it first. See lib/zLayers for the full ordering.
  return createPortal(
    <div className={`safe-screen-inset fixed inset-0 ${Z_LAYERS.lockScreen} flex items-start justify-center overflow-y-auto bg-background/95 backdrop-blur-md animate-in fade-in duration-300`}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="view-enter my-auto flex w-full max-w-sm flex-col items-center gap-6 outline-none"
      >
        <AppLogo className="size-16 rounded-2xl shadow-xl shadow-primary/20" />
        <div className="text-center">
          <h2 id={titleId} className="text-xl font-bold text-foreground">
            {mode === 'pwa-launch' ? 'Unlock FinancialApp' : 'Session locked'}
          </h2>
          <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
            {mode === 'pwa-launch'
              ? isOnline
                ? isAndroidInstalledMobilePwa()
                  ? 'Tap Unlock with device to open Android’s biometric prompt. Password unlock needs an internet connection.'
                  : 'Verify with your device to open FinancialApp. Password unlock needs an internet connection.'
                : 'Verify with your device to open FinancialApp. You are offline, so password unlock is unavailable.'
              : fingerprintAvailable
              ? 'You were inactive for 5 minutes. Use your device unlock or enter your password to continue.'
              : 'You were inactive for 5 minutes. Enter your password to continue.'}
          </p>
        </div>

        {lockError && <AlertBanner variant="error" className="w-full">{lockError}</AlertBanner>}

        {fingerprintAvailable && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => void handleFingerprintUnlock()}
            disabled={fingerprintVerifying || passwordVerifying}
            className="w-full rounded-xl py-3 shadow-lg shadow-emerald-500/10"
          >
            <ShieldCheck className="size-5 text-emerald-400 animate-pulse" />
            {fingerprintVerifying
              ? 'Verifying device...'
              : mode === 'pwa-launch' && hasAttemptedDeviceUnlock
                ? 'Try again'
                : 'Unlock with device'}
          </Button>
        )}

        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault()
            if (!lockPassword) {
              setPasswordError('Password is required.')
              focusFirstInvalidField(e.currentTarget)
              return
            }
            setPasswordVerifying(true)
            setLockError(null)
            setPasswordError(null)
            if (mode === 'pwa-launch' && !navigator.onLine) {
              setLockError('Password unlock needs an internet connection. Try device unlock instead.')
              return
            }
            try {
              const res = await api.verifyPassword(lockPassword)
              if (res.verified) {
                setLockPassword('')
                onUnlocked()
              } else {
                setPasswordError(res.message || 'Incorrect password.')
              }
            } catch (err: unknown) {
              // Only a genuine transport failure means "backend waking up". A
              // rejected request carries a status and its own message (a wrong
              // password, a rate limit, a validation error) — reporting all of
              // those as a connection problem hid what actually happened.
              setLockError(getStatus(err) === undefined
                ? 'Could not connect to server (backend waking up?). Please wait a moment and try again.'
                : getErrorMessage(err, 'Incorrect password.'))
            } finally {
              setPasswordVerifying(false)
            }
          }}
          className="w-full space-y-3"
        >
          <FormField label="Password" required error={passwordError} labelClassName="sr-only">
            <Input
              type="password"
              required
              placeholder="Enter your password"
              value={lockPassword}
              onChange={e => {
                setLockPassword(e.target.value)
                if (passwordError) setPasswordError(null)
              }}
              controlSize="lg"
              className="bg-card"
            />
          </FormField>
          <Button
            type="submit"
            size="lg"
            disabled={passwordVerifying || fingerprintVerifying || !lockPassword || (mode === 'pwa-launch' && !isOnline)}
            className="w-full rounded-xl py-3 shadow-lg shadow-primary/20"
          >
            {passwordVerifying ? 'Unlocking…' : 'Unlock with Password'}
          </Button>
        </form>
        <Button
          variant="tertiary"
          onClick={handleSignOut}
          className="text-xs text-muted-foreground hover:text-foreground transition cursor-pointer underline"
        >
          Sign out instead
        </Button>
      </div>
    </div>,
    document.body
  )
}
