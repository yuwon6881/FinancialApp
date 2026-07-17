import React, { useState, useEffect } from 'react'
import { Lock, User, ShieldAlert, Sparkles, Eye, EyeOff, Fingerprint, ShieldCheck } from 'lucide-react'
import * as api from '../lib/api'
import { AppLogo } from './ui/AppLogo'
import { isPlatformAuthenticatorAvailable, getFingerprintAssertion } from '../lib/webauthn'
import {
  clearCachedFingerprintLoginOptions,
  getCachedFingerprintLoginOptions,
  prefetchFingerprintLoginOptions,
} from '../lib/fingerprintOptionsCache'
import { getErrorMessage, getErrorName } from '../lib/errors'

interface LoginViewProps {
  onLoginSuccess: (token: string, username: string) => void
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [isRegistered, setIsRegistered] = useState<boolean | null>(() => {
    const cached = localStorage.getItem('cached_is_registered')
    return cached === 'true' ? true : cached === 'false' ? false : null
  })
  const [hasFingerprint, setHasFingerprint] = useState(false)
  const [registrationOpen, setRegistrationOpen] = useState(false)
  // When accounts already exist but more slots remain, the user can opt into a signup form.
  const [wantsRegister, setWantsRegister] = useState(false)
  const [platformAuthAvailable, setPlatformAuthAvailable] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [fingerprintLoading, setFingerprintLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)

  async function checkStatus() {
    try {
      const res = await api.fetchAuthStatus()
      setIsRegistered(res.isRegistered)
      setHasFingerprint(res.hasFingerprint)
      // Fall back to the legacy meaning (open only before the first user) if an older API
      // build doesn't send registrationOpen.
      setRegistrationOpen(res.registrationOpen ?? !res.isRegistered)
      localStorage.setItem('cached_is_registered', res.isRegistered.toString())
    } catch (err) {
      console.error(err)
      setError('Could not connect to the backend server. Please make sure the API is running.')
    }
  }

  useEffect(() => {
    checkStatus()
    isPlatformAuthenticatorAvailable().then(setPlatformAuthAvailable)
  }, [])

  useEffect(() => {
    if (!isRegistered || !hasFingerprint || !platformAuthAvailable) {
      clearCachedFingerprintLoginOptions()
      return
    }
    void prefetchFingerprintLoginOptions().catch(() => undefined)
  }, [isRegistered, hasFingerprint, platformAuthAvailable])

  // No account yet (first user) OR an invitee who opted into signup while slots remain.
  const registering = !isRegistered || wantsRegister

  const toggleRegisterMode = () => {
    setWantsRegister(prev => !prev)
    setConfirmPassword('')
    setErrors({})
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!username.trim()) {
      newErrors.username = 'Username is required.'
    }
    if (!password.trim()) {
      newErrors.password = 'Password is required.'
    }
    if (registering) {
      if (!confirmPassword.trim()) {
        newErrors.confirmPassword = 'Confirm password is required.'
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match.'
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    setError(null)
    setLoading(true)

    try {
      if (registering) {
        // Register flow (first user, or an additional invitee while slots remain)
        await api.register({ username, password })
        localStorage.setItem('cached_is_registered', 'true')
        // Immediately login after successful registration
        const loginRes = await api.login({ username, password })
        if ('requiresTwoFactor' in loginRes) {
          setPendingToken(loginRes.pendingToken)
        } else {
          onLoginSuccess(loginRes.token, loginRes.username)
        }
      } else {
        // Login flow
        const loginRes = await api.login({ username, password })
        localStorage.setItem('cached_is_registered', 'true')
        if ('requiresTwoFactor' in loginRes) {
          setPendingToken(loginRes.pendingToken)
        } else {
          onLoginSuccess(loginRes.token, loginRes.username)
        }
      }
    } catch (err: unknown) {
      console.error(err)
      setError(getErrorMessage(err, 'Authentication failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingToken) return
    if (!twoFactorCode.trim()) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setError(null)
    setTwoFactorLoading(true)
    try {
      const res = await api.verifyTwoFactorLogin(pendingToken, twoFactorCode.trim())
      onLoginSuccess(res.token, res.username)
    } catch (err: unknown) {
      console.error(err)
      setError(getErrorMessage(err, 'Invalid code. Please try again.'))
    } finally {
      setTwoFactorLoading(false)
    }
  }

  const handleFingerprintLogin = async () => {
    setError(null)
    setFingerprintLoading(true)
    try {
      const { challengeId, options } = await getCachedFingerprintLoginOptions()
      const credential = await getFingerprintAssertion(options)
      const res = await api.verifyFingerprintLogin(challengeId, credential)
      onLoginSuccess(res.token, res.username)
    } catch (err: unknown) {
      console.error(err)
      if (getErrorName(err) === 'NotAllowedError') {
        // User cancelled the prompt or it timed out - not worth alarming them.
      } else {
        setError(getErrorMessage(err, 'Fingerprint login failed. Please use your password instead.'))
      }
    } finally {
      clearCachedFingerprintLoginOptions()
      setFingerprintLoading(false)
    }
  }

  if (isRegistered === null && !error) {
    return (
      <div className="app-shell min-h-screen text-foreground flex items-center justify-center select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-xs font-semibold text-muted-foreground">Checking authentication status...</p>
        </div>
      </div>
    )
  }

  if (pendingToken) {
    return (
      <div className="app-shell min-h-screen text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card/60 backdrop-blur-xl border border-border/60 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
          <div className="text-center space-y-2 select-none">
            <div className="mx-auto size-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <ShieldCheck className="size-6 text-blue-500" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Two-Factor Verification</h1>
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code from your authenticator app, or one of your recovery codes.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-start gap-2.5 animate-in slide-in-from-top-2 duration-200">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form noValidate onSubmit={handleTwoFactorSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Verification code</label>
              <input
                type="text"
                inputMode="text"
                autoFocus
                disabled={twoFactorLoading}
                placeholder="123456"
                value={twoFactorCode}
                onChange={e => setTwoFactorCode(e.target.value)}
                autoComplete="one-time-code"
                className="w-full px-3.5 py-2 text-sm text-center tracking-[0.3em] bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
              />
            </div>

            <button
              type="submit"
              disabled={twoFactorLoading}
              className="press-scale w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/15 hover:shadow-blue-600/25 transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              {twoFactorLoading ? (
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                'Verify'
              )}
            </button>

            <button
              type="button"
              onClick={() => { setPendingToken(null); setTwoFactorCode(''); setError(null) }}
              className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              Back to login
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card/60 backdrop-blur-xl border border-border/60 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-2 select-none">
          <AppLogo className="mx-auto size-12 rounded-2xl shadow-xl shadow-blue-500/15" pulse />
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            FinancialApp <span className="text-blue-500">Ledger</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            {registering
              ? 'Create your account credentials to get started.'
              : 'Enter password to unlock your dashboard.'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-start gap-2.5 animate-in slide-in-from-top-2 duration-200">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Username</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 size-4 pointer-events-none" />
              <input
                type="text"
                disabled={loading}
                placeholder="Admin username"
                value={username}
                onChange={e => {
                  setUsername(e.target.value)
                  if (errors.username) {
                    setErrors(prev => ({ ...prev, username: '' }))
                  }
                }}
                autoComplete="off"
                className={`w-full pl-10 pr-3.5 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
                  errors.username 
                    ? 'border-destructive focus:ring-destructive' 
                    : 'border-border focus:ring-blue-500'
                }`}
              />
            </div>
            {errors.username && (
              <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                {errors.username}
              </p>
            )}
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 size-4 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                disabled={loading}
                placeholder="••••••••"
                value={password}
                onChange={e => {
                  setPassword(e.target.value)
                  if (errors.password) {
                    setErrors(prev => ({ ...prev, password: '' }))
                  }
                }}
                autoComplete="new-password"
                className={`w-full pl-10 pr-10 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
                  errors.password 
                    ? 'border-destructive focus:ring-destructive' 
                    : 'border-border focus:ring-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 -m-1 text-muted-foreground hover:text-foreground transition cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                {errors.password}
              </p>
            )}
          </div>

          {/* Confirm Password (only for registration) */}
          {registering && (
            <div className="space-y-1 animate-in fade-in duration-200">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  disabled={loading}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value)
                    if (errors.confirmPassword) {
                      setErrors(prev => ({ ...prev, confirmPassword: '' }))
                    }
                  }}
                  autoComplete="new-password"
                  readOnly
                  onFocus={(e) => e.target.removeAttribute('readonly')}
                  className={`w-full pl-10 pr-10 py-2.5 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
                    errors.confirmPassword 
                      ? 'border-destructive focus:ring-destructive' 
                      : 'border-border focus:ring-blue-500'
                  }`}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (isRegistered === null)}
            className="press-scale w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/15 hover:shadow-blue-600/25 transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : registering ? (
              <>
                <Sparkles className="size-4" /> Create Credentials
              </>
            ) : (
              'Unlock Ledger Dashboard'
            )}
          </button>
        </form>

        {/* Additional-user signup toggle: only when at least one account exists and slots remain. */}
        {isRegistered && registrationOpen && (
          <button
            type="button"
            onClick={toggleRegisterMode}
            disabled={loading}
            className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer disabled:opacity-50"
          >
            {wantsRegister ? 'Back to sign in' : 'Create a new account'}
          </button>
        )}

        {!registering && isRegistered && hasFingerprint && platformAuthAvailable && (
          <button
            type="button"
            onClick={handleFingerprintLogin}
            disabled={fingerprintLoading}
            className="press-scale w-full py-2.5 border border-border hover:bg-muted/50 disabled:opacity-50 text-foreground font-semibold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            {fingerprintLoading ? (
              <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            ) : (
              <Fingerprint className="size-4 text-blue-500" />
            )}
            Unlock with Fingerprint
          </button>
        )}

        <div className="text-center text-[10px] text-muted-foreground select-none">
          Secure Personal Financial Ledger
        </div>
      </div>
    </div>
  )
}
