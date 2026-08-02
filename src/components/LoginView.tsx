import { Input } from './ui/Input'
import React, { useState, useEffect } from 'react'
import { Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import * as api from '../lib/api'
import { AppLogo } from './ui/AppLogo'
import { isPlatformAuthenticatorAvailable, getFingerprintAssertion } from '../lib/webauthn'
import {
  clearCachedFingerprintLoginOptions,
  getCachedFingerprintLoginOptions,
  prefetchFingerprintLoginOptions,
} from '../lib/fingerprintOptionsCache'
import { getErrorMessage, getErrorName } from '../lib/errors'
import { SecurityQuestionSetup } from './SecurityQuestionSetup'
import { ForgotPassword } from './ForgotPassword'
import { AlertBanner } from './ui/AlertBanner'
import { AuthCard, AuthHeader, AuthLoadingState, AuthShell } from './ui/AuthLayout'
import { Button } from './ui/Button'
import { FormField } from './ui/FormField'
import { focusFirstInvalidField } from './ui/formValidation'

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
  const [loginStep, setLoginStep] = useState<1 | 2>(1)
  const [needsSecuritySetup, setNeedsSecuritySetup] = useState(false)
  const [loginResData, setLoginResData] = useState<{token: string, username: string} | null>(null)
  const [forgotPassword, setForgotPassword] = useState(false)

  async function checkStatus() {
    try {
      const res = await api.fetchAuthStatus()
      setIsRegistered(res.isRegistered)
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

  // No account yet (first user) OR an invitee who opted into signup while slots remain.
  const registering = !isRegistered || wantsRegister

  useEffect(() => {
    clearCachedFingerprintLoginOptions()
    if (!isRegistered || !platformAuthAvailable || registering || loginStep !== 2 || !username.trim()) {
      setHasFingerprint(false)
      return
    }

    let cancelled = false
    setHasFingerprint(false)
    void api.fetchAuthStatus(username.trim()).then(status => {
      if (cancelled) return
      setHasFingerprint(status.hasFingerprintOnDevice)
      if (status.hasFingerprintOnDevice) {
        void prefetchFingerprintLoginOptions(username.trim()).catch(() => undefined)
      }
    }).catch(() => undefined)

    return () => {
      cancelled = true
      clearCachedFingerprintLoginOptions()
    }
  }, [isRegistered, platformAuthAvailable, registering, loginStep, username])

  const toggleRegisterMode = () => {
    setWantsRegister(prev => !prev)
    setConfirmPassword('')
    setErrors({})
    setError(null)
    setLoginStep(1)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!username.trim()) {
      newErrors.username = 'Username is required.'
    }

    if (!registering && loginStep === 1) {
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors)
        focusFirstInvalidField(e.currentTarget)
        return
      }
      setErrors({})
      setError(null)
      setLoginStep(2)
      return
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
      focusFirstInvalidField(e.currentTarget)
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
        } else if (loginRes.hasSetupSecurityQuestions === false) {
          setLoginResData({ token: loginRes.token, username: loginRes.username })
          setNeedsSecuritySetup(true)
        } else {
          onLoginSuccess(loginRes.token, loginRes.username)
        }
      } else {
        // Login flow
        const loginRes = await api.login({ username, password })
        localStorage.setItem('cached_is_registered', 'true')
        if ('requiresTwoFactor' in loginRes) {
          setPendingToken(loginRes.pendingToken)
        } else if (loginRes.hasSetupSecurityQuestions === false) {
          setLoginResData({ token: loginRes.token, username: loginRes.username })
          setNeedsSecuritySetup(true)
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

  const handleTwoFactorSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!pendingToken) return
    if (!twoFactorCode.trim()) {
      setErrors({ twoFactorCode: 'Verification code is required.' })
      focusFirstInvalidField(e.currentTarget)
      return
    }
    setErrors({})
    setError(null)
    setTwoFactorLoading(true)
    try {
      const res = await api.verifyTwoFactorLogin(pendingToken, twoFactorCode.trim())
      if (res.hasSetupSecurityQuestions === false) {
        setLoginResData({ token: res.token, username: res.username })
        setNeedsSecuritySetup(true)
      } else {
        onLoginSuccess(res.token, res.username)
      }
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
      const { challengeId, options } = await getCachedFingerprintLoginOptions(username.trim())
      const credential = await getFingerprintAssertion(options)
      const res = await api.verifyFingerprintLogin(challengeId, credential)
      if (res.hasSetupSecurityQuestions === false) {
        setLoginResData({ token: res.token, username: res.username })
        setNeedsSecuritySetup(true)
      } else {
        onLoginSuccess(res.token, res.username)
      }
    } catch (err: unknown) {
      console.error(err)
      if (getErrorName(err) === 'NotAllowedError') {
        // User cancelled the prompt or it timed out - not worth alarming them.
      } else {
        setError(getErrorMessage(err, 'Device unlock failed. Please use your password instead.'))
      }
    } finally {
      clearCachedFingerprintLoginOptions()
      setFingerprintLoading(false)
    }
  }

  if (isRegistered === null && !error) {
    return <AuthLoadingState label="Checking authentication status…" />
  }

  if (forgotPassword) {
    return <ForgotPassword onBackToLogin={() => setForgotPassword(false)} />
  }

  if (needsSecuritySetup && loginResData) {
    return (
      <SecurityQuestionSetup
        onComplete={() => onLoginSuccess(loginResData.token, loginResData.username)}
      />
    )
  }

  if (pendingToken) {
    return (
      <AuthShell>
        <AuthCard>
          <AuthHeader
            icon={<span className="flex size-12 items-center justify-center rounded-2xl bg-blue-500/10"><ShieldCheck className="size-6 text-blue-500" /></span>}
            title="Two-factor verification"
            description="Enter the code from your authenticator app, or use one of your recovery codes."
          />

          {error && (
            <AlertBanner variant="error">{error}</AlertBanner>
          )}

          <form noValidate onSubmit={handleTwoFactorSubmit} className="space-y-4">
            <FormField
              label="Verification code"
              required
              error={errors.twoFactorCode}
              labelClassName="uppercase tracking-wider"
            >
              <Input
                type="text"
                inputMode="text"
                autoFocus
                disabled={twoFactorLoading}
                placeholder="123456"
                value={twoFactorCode}
                onChange={e => {
                  setTwoFactorCode(e.target.value)
                  if (errors.twoFactorCode) setErrors(previous => ({ ...previous, twoFactorCode: '' }))
                }}
                autoComplete="one-time-code"
                className="text-center tracking-[0.3em]"
              />
            </FormField>

            <Button
              type="submit"
              size="lg"
              disabled={twoFactorLoading}
              className="w-full rounded-xl py-3 shadow-lg shadow-primary/15"
            >
              {twoFactorLoading ? (
                <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
              ) : (
                'Verify'
              )}
            </Button>

            <Button
              type="button"
              variant="unstyled"
              onClick={() => { setPendingToken(null); setTwoFactorCode(''); setError(null) }}
              className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              Back to login
            </Button>
          </form>
        </AuthCard>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthCard>
        <AuthHeader
          icon={<AppLogo className="size-12 rounded-2xl shadow-xl shadow-primary/15" pulse />}
          title={<>FinancialApp <span className="text-accent-ink">Ledger</span></>}
          description={registering
            ? 'Create your account to get started.'
            : loginStep === 1
              ? 'Enter your username to continue.'
              : hasFingerprint && platformAuthAvailable
                ? 'Enter your password or use device unlock.'
                : 'Enter your password to continue.'}
        />

        {error && (
          <AlertBanner variant="error">{error}</AlertBanner>
        )}

        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input */}
          {(registering || loginStep === 1) && (
            <FormField
              label="Username"
              required
              error={errors.username}
              labelClassName="uppercase tracking-wider"
            >
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex w-10 items-center justify-center pointer-events-none">
                  <User className="size-4 text-muted-foreground/70" />
                </span>
                <Input
                  type="text"
                  disabled={loading}
                  placeholder="Enter your username"
                  value={username}
                  onChange={e => {
                    setUsername(e.target.value)
                    if (errors.username) {
                      setErrors(prev => ({ ...prev, username: '' }))
                    }
                  }}
                  autoComplete="username"
                  className="pl-10"
                />
              </div>
            </FormField>
          )}

          {!registering && loginStep === 2 && (
            <div className="flex items-center justify-between gap-3 bg-muted/40 p-2.5 pl-3 rounded-2xl border border-border/50 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 font-black text-sm uppercase select-none">
                  {username.trim().charAt(0) || <User className="size-4" />}
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Signing in as</p>
                  <p className="text-sm font-bold text-foreground truncate">{username}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setLoginStep(1); setPassword(''); setError(null) }} className="shrink-0 text-muted-foreground shadow-sm">
                Change
              </Button>
            </div>
          )}

          {/* Password Input */}
          {(registering || loginStep === 2) && (
            <FormField
              label="Password"
              required
              error={errors.password}
              className="animate-in fade-in slide-in-from-right-4 duration-300"
              labelClassName="uppercase tracking-wider"
            >
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex w-10 items-center justify-center pointer-events-none">
                <Lock className="size-4 text-muted-foreground/70" />
              </span>
              <Input
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
                autoComplete={registering ? 'new-password' : 'current-password'}
                className="no-native-reveal pl-10 pr-10"
              />
              {password.length > 0 && (
                <Button
                  type="button"
                  variant="unstyled"
                  size="icon"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              )}
            </div>
              {!registering && loginStep === 2 && (
                <div className="flex justify-end mt-1">
                  <Button
                    type="button"
                    variant="unstyled"
                    onClick={() => setForgotPassword(true)}
                    className="text-xs font-semibold text-blue-500 hover:text-blue-600 focus:outline-none focus:underline"
                  >
                    Forgot Password?
                  </Button>
                </div>
              )}
            </FormField>
          )}

          {/* Confirm Password (only for registration) */}
          {registering && (
            <FormField
              label="Confirm password"
              required
              error={errors.confirmPassword}
              className="animate-in fade-in duration-200"
              labelClassName="uppercase tracking-wider"
            >
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex w-10 items-center justify-center pointer-events-none">
                  <Lock className="size-4 text-muted-foreground/70" />
                </span>
                <Input
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
                  className="no-native-reveal pl-10 pr-10"
                />
              </div>
            </FormField>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={loading || (isRegistered === null)}
            className="w-full rounded-xl py-3 shadow-lg shadow-primary/15"
          >
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            ) : registering ? (
              'Create account'
            ) : loginStep === 1 ? (
              'Continue'
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        {/* Additional-user signup toggle: only when at least one account exists and slots remain. */}
        {isRegistered && registrationOpen && loginStep === 1 && (
          <Button
            type="button"
            variant="unstyled"
            onClick={toggleRegisterMode}
            disabled={loading}
            className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer disabled:opacity-50"
          >
            {wantsRegister ? 'Back to sign in' : 'Create a new account'}
          </Button>
        )}

        {!registering && isRegistered && hasFingerprint && platformAuthAvailable && loginStep === 2 && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleFingerprintLogin}
            disabled={fingerprintLoading}
            className="w-full rounded-xl"
          >
            {fingerprintLoading ? (
              <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            ) : (
              <ShieldCheck className="size-4 text-blue-500" />
            )}
            Unlock with device
          </Button>
        )}

        <div className="text-center text-[10px] text-muted-foreground select-none">
          Secure Personal Financial Ledger
        </div>
      </AuthCard>
    </AuthShell>
  )
}
