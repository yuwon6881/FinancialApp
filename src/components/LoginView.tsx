import React, { useState, useEffect } from 'react'
import { Lock, User, ShieldAlert, Sparkles, Eye, EyeOff, Fingerprint } from 'lucide-react'
import * as api from '../lib/api'
import { AppLogo } from './ui/AppLogo'
import { isFingerprintSupported, getFingerprintAssertion } from '../lib/webauthn'

interface LoginViewProps {
  onLoginSuccess: (token: string, username: string) => void
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null)
  const [hasFingerprint, setHasFingerprint] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fingerprintLoading, setFingerprintLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function checkStatus() {
    try {
      const res = await api.fetchAuthStatus()
      setIsRegistered(res.isRegistered)
      setHasFingerprint(res.hasFingerprint)
    } catch (err) {
      console.error(err)
      setError('Could not connect to the backend server. Please make sure the API is running.')
    }
  }

  useEffect(() => {
    checkStatus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    setError(null)
    setLoading(true)

    try {
      if (!isRegistered) {
        // Register flow
        if (password !== confirmPassword) {
          setError('Passwords do not match.')
          setLoading(false)
          return
        }
        await api.register({ username, password })
        // Immediately login after successful registration
        const loginRes = await api.login({ username, password })
        onLoginSuccess(loginRes.token, loginRes.username)
      } else {
        // Login flow
        const loginRes = await api.login({ username, password })
        onLoginSuccess(loginRes.token, loginRes.username)
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleFingerprintLogin = async () => {
    setError(null)
    setFingerprintLoading(true)
    try {
      const { challengeId, options } = await api.getFingerprintLoginOptions()
      const credential = await getFingerprintAssertion(options)
      const res = await api.verifyFingerprintLogin(challengeId, credential)
      onLoginSuccess(res.token, res.username)
    } catch (err: any) {
      console.error(err)
      if (err?.name === 'NotAllowedError') {
        // User cancelled the prompt or it timed out - not worth alarming them.
      } else {
        setError(err.message || 'Fingerprint login failed. Please use your password instead.')
      }
    } finally {
      setFingerprintLoading(false)
    }
  }

  if (isRegistered === null && !error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-xs font-semibold text-muted-foreground">Checking authentication status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-muted/10 to-background text-foreground flex items-center justify-center p-4">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-[20%] left-[30%] -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-[20%] right-[30%] translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md bg-card/60 backdrop-blur-xl border border-border/60 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2 select-none">
          <AppLogo className="mx-auto size-12 rounded-2xl shadow-xl shadow-blue-500/15" pulse />
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            FinancialApp <span className="text-blue-500">Ledger</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            {!isRegistered 
              ? 'Create your password to get started.' 
              : 'Enter password to unlock your dashboard.'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-start gap-2.5 animate-in slide-in-from-top-2 duration-200">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Username</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 size-4 pointer-events-none" />
              <input
                type="text"
                required
                disabled={loading}
                placeholder="Admin username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="off"
                className="w-full pl-10 pr-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 size-4 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={loading}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full pl-10 pr-10 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
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
          </div>

          {/* Confirm Password (only for registration) */}
          {!isRegistered && (
            <div className="space-y-1 animate-in fade-in duration-200">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={loading}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  readOnly
                  onFocus={(e) => e.target.removeAttribute('readonly')}
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (isRegistered === null)}
            className="press-scale w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/15 hover:shadow-blue-600/25 transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : !isRegistered ? (
              <>
                <Sparkles className="size-4" /> Create Credentials
              </>
            ) : (
              'Unlock Ledger Dashboard'
            )}
          </button>
        </form>

        {isRegistered && hasFingerprint && isFingerprintSupported() && (
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
