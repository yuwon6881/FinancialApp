import { useState, useEffect } from 'react'
import { Fingerprint } from 'lucide-react'
import * as api from '../lib/api'
import { AppLogo } from './ui/AppLogo'
import { isFingerprintSupported, getFingerprintAssertion } from '../lib/webauthn'

interface LockScreenProps {
  isOpen: boolean
  onUnlocked: () => void
  onSignOut: () => void
}

export function LockScreen({ isOpen, onUnlocked, onSignOut }: LockScreenProps) {
  const [lockPassword, setLockPassword] = useState('')
  const [lockError, setLockError] = useState<string | null>(null)
  const [lockVerifying, setLockVerifying] = useState(false)
  const [fingerprintAvailable, setFingerprintAvailable] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    ;(async () => {
      if (!isFingerprintSupported()) return
      try {
        const status = await api.fetchAuthStatus()
        if (cancelled || !status.hasFingerprint) return
        setFingerprintAvailable(true)
        // Auto-trigger fingerprint unlock on screen lock open
        handleFingerprintUnlock()
      } catch {
        // Backend unreachable - fall through to password unlock only.
      }
    })()

    return () => { cancelled = true }
  }, [isOpen])

  const handleFingerprintUnlock = async () => {
    setLockVerifying(true)
    setLockError(null)
    try {
      const { challengeId, options } = await api.getFingerprintLoginOptions()
      const credential = await getFingerprintAssertion(options)
      await api.verifyFingerprintLogin(challengeId, credential)
      setLockPassword('')
      onUnlocked()
    } catch (err: any) {
      console.error(err)
      if (err?.name !== 'NotAllowedError') {
        setLockError(err.message || 'Fingerprint unlock failed. Please use your password.')
      }
    } finally {
      setLockVerifying(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/95 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <AppLogo className="size-16 rounded-2xl shadow-xl shadow-blue-500/20" />
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">Session Locked</h2>
          <p className="text-sm text-muted-foreground mt-1">You were inactive for 5 minutes. Touch fingerprint or enter password to continue.</p>
        </div>

        {fingerprintAvailable && (
          <button
            type="button"
            onClick={handleFingerprintUnlock}
            disabled={lockVerifying}
            className="press-scale w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
          >
            <Fingerprint className="size-5 text-emerald-400 animate-pulse" />
            {lockVerifying ? 'Verifying Fingerprint...' : 'Unlock with Fingerprint'}
          </button>
        )}

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setLockVerifying(true)
            setLockError(null)
            try {
              const res = await api.verifyPassword(lockPassword)
              if (res.verified) {
                setLockPassword('')
                onUnlocked()
              } else {
                setLockError(res.message || 'Incorrect password.')
              }
            } catch {
              setLockError('Could not connect to server (backend waking up?). Please wait a moment and try again.')
            } finally {
              setLockVerifying(false)
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
            className="w-full px-4 py-3 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          {lockError && (
            <p className="text-xs text-orange-500 font-semibold">{lockError}</p>
          )}
          <button
            type="submit"
            disabled={lockVerifying}
            className="press-scale w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition cursor-pointer"
          >
            {lockVerifying ? 'Unlocking...' : 'Unlock with Password'}
          </button>
        </form>
        <button
          onClick={onSignOut}
          className="text-xs text-muted-foreground hover:text-foreground transition cursor-pointer underline"
        >
          Sign out instead
        </button>
      </div>
    </div>
  )
}
