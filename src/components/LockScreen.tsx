import { useState, useEffect } from 'react'
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

interface LockScreenProps {
  isOpen: boolean
  username: string
  onUnlocked: () => void
  onSignOut: () => void
}

export function LockScreen({ isOpen, username, onUnlocked, onSignOut }: LockScreenProps) {
  const [lockPassword, setLockPassword] = useState('')
  const [lockError, setLockError] = useState<string | null>(null)
  const [passwordVerifying, setPasswordVerifying] = useState(false)
  const [fingerprintVerifying, setFingerprintVerifying] = useState(false)
  const [fingerprintAvailable, setFingerprintAvailable] = useState(false)

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
      if (!platformAvailable || cancelled || !status?.hasFingerprint) return
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-background/95 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <AppLogo className="size-16 rounded-2xl shadow-xl shadow-primary/20" />
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">Session Locked</h2>
          <p className="text-sm text-muted-foreground mt-1">You were inactive for 5 minutes. Use your device unlock or enter your password to continue.</p>
        </div>

        {fingerprintAvailable && (
          <button
            type="button"
            onClick={handleFingerprintUnlock}
            disabled={fingerprintVerifying || passwordVerifying}
            className="press-scale w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
          >
            <ShieldCheck className="size-5 text-emerald-400 animate-pulse" />
            {fingerprintVerifying ? 'Verifying device...' : 'Unlock with device'}
          </button>
        )}

        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault()
            if (!lockPassword) {
              setLockError('Enter your password to unlock.')
              return
            }
            setPasswordVerifying(true)
            setLockError(null)
            try {
              const res = await api.verifyPassword(lockPassword)
              if (res.verified) {
                setLockPassword('')
                onUnlocked()
              } else {
                setLockError(res.message || 'Incorrect password.')
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
          <input
            type="password"
            required
            placeholder="Enter your password"
            value={lockPassword}
            onChange={e => setLockPassword(e.target.value)}
            autoFocus={!fingerprintAvailable}
            className="w-full px-4 py-3 text-sm bg-card border border-border rounded-xl focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/40 transition"
          />
          {lockError && (
            <p className="text-xs text-destructive font-semibold">{lockError}</p>
          )}
          <button
            type="submit"
            disabled={passwordVerifying || fingerprintVerifying || !lockPassword}
            className="press-scale w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/20 transition cursor-pointer"
          >
            {passwordVerifying ? 'Unlocking...' : 'Unlock with Password'}
          </button>
        </form>
        <button
          onClick={onSignOut}
          className="text-xs text-muted-foreground hover:text-foreground transition cursor-pointer underline"
        >
          Sign out instead
        </button>
      </div>
    </div>,
    document.body
  )
}
