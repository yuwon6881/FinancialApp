import { Input } from './ui/Input'
import { useState, useEffect, useId, useRef } from 'react'
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
import { getErrorMessage, getErrorName, getStatus } from '../lib/errors'
import { AlertBanner } from './ui/AlertBanner'
import { Button } from './ui/Button'
import { FormField } from './ui/FormField'
import { focusFirstInvalidField } from './ui/formValidation'
import { useDialog } from '../lib/useDialog'

interface LockScreenProps {
  isOpen: boolean
  username: string
  onUnlocked: () => void
  onSignOut: () => void
}

export function LockScreen({ isOpen, username, onUnlocked, onSignOut }: LockScreenProps) {
  const [lockPassword, setLockPassword] = useState('')
  const [lockError, setLockError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordVerifying, setPasswordVerifying] = useState(false)
  const [fingerprintVerifying, setFingerprintVerifying] = useState(false)
  const [fingerprintAvailable, setFingerprintAvailable] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useDialog({
    isOpen,
    onClose: () => undefined,
    ref: panelRef,
    canClose: () => false,
  })

  useEffect(() => {
    if (!isOpen) {
      setFingerprintAvailable(false)
      clearCachedFingerprintAssertOptions()
      return
    }

    setFingerprintAvailable(false)
    let cancelled = false
    ;(async () => {
      const [platformAvailable, status] = await Promise.all([
        isPlatformAuthenticatorAvailable(),
        api.fetchAuthStatus(username).catch(() => null),
      ])
      if (!platformAvailable || cancelled || !status?.hasFingerprintOnDevice) return
      try {
        setFingerprintAvailable(true)
        void prefetchFingerprintAssertOptions().catch(() => undefined)
      } catch {
        // Backend unreachable - fall through to password unlock only.
      }
    })()

    return () => {
      cancelled = true
      clearCachedFingerprintAssertOptions()
    }
  }, [isOpen, username])

  const handleFingerprintUnlock = async () => {
    setFingerprintVerifying(true)
    setLockError(null)
    setPasswordError(null)
    try {
      const { challengeId, options } = await getCachedFingerprintAssertOptions()
      const credential = await getFingerprintAssertion(options)
      await api.verifyFingerprintAssert(challengeId, credential)
      setLockPassword('')
      onUnlocked()
    } catch (err: unknown) {
      console.error(err)
      if (getErrorName(err) !== 'NotAllowedError') {
        setLockError(getErrorMessage(err, 'Device unlock failed. Please use your password.'))
      }
    } finally {
      clearCachedFingerprintAssertOptions()
      setFingerprintVerifying(false)
    }
  }

  if (!isOpen) return null

  // Rendered through a portal to document.body so the lock overlay is a top-level
  // stacking sibling of every other portal (bottom sheets, modals, the AI chat panel).
  // Mounted inside App's tree its z-[300] was trapped in a nested stacking context and
  // the sheet portals (z-[100]) painted over it; at body level the higher z-index wins,
  // so the lock screen always covers any open modal without having to close it first.
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background/95 p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="view-enter flex w-full max-w-sm flex-col items-center gap-6 outline-none"
      >
        <AppLogo className="size-16 rounded-2xl shadow-xl shadow-primary/20" />
        <div className="text-center">
          <h2 id={titleId} className="text-xl font-bold text-foreground">Session locked</h2>
          <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
            {fingerprintAvailable
              ? 'You were inactive for 5 minutes. Use your device unlock or enter your password to continue.'
              : 'You were inactive for 5 minutes. Enter your password to continue.'}
          </p>
        </div>

        {lockError && <AlertBanner variant="error" className="w-full">{lockError}</AlertBanner>}

        {fingerprintAvailable && (
          <Button
            type="button"
            variant="successGhost"
            size="lg"
            onClick={handleFingerprintUnlock}
            disabled={fingerprintVerifying || passwordVerifying}
            className="w-full rounded-xl py-3 shadow-lg shadow-emerald-500/10"
          >
            <ShieldCheck className="size-5 text-emerald-400 animate-pulse" />
            {fingerprintVerifying ? 'Verifying device...' : 'Unlock with device'}
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
              autoFocus={!fingerprintAvailable}
              controlSize="lg"
              className="bg-card"
            />
          </FormField>
          <Button
            type="submit"
            size="lg"
            disabled={passwordVerifying || fingerprintVerifying || !lockPassword}
            className="w-full rounded-xl py-3 shadow-lg shadow-primary/20"
          >
            {passwordVerifying ? 'Unlocking...' : 'Unlock with Password'}
          </Button>
        </form>
        <Button
          variant="unstyled"
          onClick={onSignOut}
          className="text-xs text-muted-foreground hover:text-foreground transition cursor-pointer underline"
        >
          Sign out instead
        </Button>
      </div>
    </div>,
    document.body
  )
}
