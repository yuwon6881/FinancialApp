import React, { useState, useEffect } from 'react'
import { Lock, User, ShieldAlert, Sparkles, Eye, EyeOff } from 'lucide-react'
import * as api from '../lib/api'

interface LoginViewProps {
  onLoginSuccess: (token: string, username: string) => void
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function checkStatus() {
    try {
      const res = await api.fetchAuthStatus()
      setIsRegistered(res.isRegistered)
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

  if (isRegistered === null && !error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-xs font-semibold text-muted-foreground">Checking authentication status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-muted/10 to-background text-foreground flex items-center justify-center p-4">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-[20%] left-[30%] -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-[20%] right-[30%] translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md bg-card/60 backdrop-blur-xl border border-border/60 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2 select-none">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-radial from-emerald-400 to-emerald-600 shadow-xl shadow-emerald-500/20 text-white font-extrabold text-2xl animate-pulse">
            F
          </div>
          <h1 className="text-2xl font-black tracking-tight bg-linear-to-r from-foreground via-foreground to-emerald-500 bg-clip-text text-transparent">
            FinancialApp Ledger
          </h1>
          <p className="text-xs text-muted-foreground">
            {!isRegistered 
              ? 'First-Time Setup: Initialize your master administrator credentials.' 
              : 'Secure, password-protected double-entry safe ledger.'}
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
              <User className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
              <input
                type="text"
                required
                disabled={loading}
                placeholder="e.g. admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="off"
                readOnly
                onFocus={(e) => e.target.removeAttribute('readonly')}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 transition duration-200"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={loading}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                readOnly
                onFocus={(e) => e.target.removeAttribute('readonly')}
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 transition duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3.5 top-3.5 text-muted-foreground hover:text-foreground transition cursor-pointer"
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
                <Lock className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
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
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 transition duration-200"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (isRegistered === null)}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-muted disabled:text-muted-foreground text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : !isRegistered ? (
              <>
                <Sparkles className="size-4" /> Create Admin Credentials
              </>
            ) : (
              'Unlock Ledger Dashboard'
            )}
          </button>
        </form>

        <div className="text-center text-[10px] text-muted-foreground select-none">
          Double-Entry Safe Ledger System. All data encrypted in local SQLite instance.
        </div>
      </div>
    </div>
  )
}
