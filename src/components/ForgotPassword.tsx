import React, { useState } from 'react'
import { ShieldAlert, User, Lock, Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react'
import * as api from '../lib/api'
import type { SecurityQuestion } from '../types'

interface ForgotPasswordProps {
  onBackToLogin: () => void
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBackToLogin }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [username, setUsername] = useState('')
  const [questions, setQuestions] = useState<SecurityQuestion[]>([])

  const [a1, setA1] = useState('')
  const [a2, setA2] = useState('')
  const [a3, setA3] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!username.trim()) {
      setError('Username is required.')
      return
    }

    setLoading(true)
    try {
      const res = await api.startSecurityQuestionsRecovery(username)
      if (res.questions && res.questions.length === 3) {
        setQuestions(res.questions)
        setStep(2)
      } else {
        setError('This account does not have security questions configured.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!a1.trim() || !a2.trim() || !a3.trim()) {
      setError('Please answer all questions.')
      return
    }
    setStep(3)
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const answers = [
        { questionId: questions[0].questionId, answer: a1 },
        { questionId: questions[1].questionId, answer: a2 },
        { questionId: questions[2].questionId, answer: a3 },
      ]

      await api.resetPasswordViaSecurityQuestions(username, answers, newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const inputBase =
    'w-full py-2.5 pl-10 pr-3.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200'

  return (
    <div className="app-shell min-h-screen text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card md:bg-card/60 md:backdrop-blur-xl border border-border/60 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">

        {success ? (
          <div className="flex flex-col items-center text-center space-y-4 select-none">
            <div className="mx-auto size-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="size-6 text-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-black tracking-tight text-foreground">Password reset</h1>
              <p className="text-xs text-muted-foreground">
                Your password has been updated and all other sessions were signed out. You can now log
                in with your new password.
              </p>
            </div>
            <button
              onClick={onBackToLogin}
              className="press-scale w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/15 hover:shadow-blue-600/25 transition duration-200 cursor-pointer"
            >
              Return to login
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center space-y-2 select-none">
              <div className="mx-auto size-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <KeyRound className="size-6 text-blue-500" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">Account recovery</h1>
              <p className="text-xs text-muted-foreground">
                {step === 1 && 'Enter your username to begin.'}
                {step === 2 && 'Answer your security questions to verify it’s you.'}
                {step === 3 && 'Create a new password for your account.'}
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 select-none">
              {[1, 2, 3].map(s => (
                <span
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s === step ? 'w-6 bg-blue-500' : s < step ? 'w-6 bg-blue-500/40' : 'w-1.5 bg-border'
                  }`}
                />
              ))}
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2.5 animate-in slide-in-from-top-2 duration-200">
                <ShieldAlert className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === 1 && (
              <form noValidate onSubmit={handleStart} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Username</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex w-10 items-center justify-center pointer-events-none">
                      <User className="size-4 text-muted-foreground/70" />
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className={inputBase}
                      placeholder="Enter your username"
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="press-scale w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/15 hover:shadow-blue-600/25 transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    'Continue'
                  )}
                </button>
              </form>
            )}

            {step === 2 && (
              <form noValidate onSubmit={handleVerify} className="space-y-4">
                {[
                  { q: questions[0]?.question, a: a1, setA: setA1 },
                  { q: questions[1]?.question, a: a2, setA: setA2 },
                  { q: questions[2]?.question, a: a3, setA: setA3 },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block leading-snug">{item.q}</label>
                    <input
                      type="text"
                      value={item.a}
                      onChange={e => item.setA(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
                      placeholder="Your answer"
                      autoComplete="off"
                      autoFocus={idx === 0}
                    />
                  </div>
                ))}
                <button
                  type="submit"
                  className="press-scale w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/15 hover:shadow-blue-600/25 transition duration-200 cursor-pointer"
                >
                  Verify answers
                </button>
              </form>
            )}

            {step === 3 && (
              <form noValidate onSubmit={handleReset} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">New password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex w-10 items-center justify-center pointer-events-none">
                      <Lock className="size-4 text-muted-foreground/70" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="no-native-reveal w-full pl-10 pr-10 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      autoFocus
                    />
                    {newPassword.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center size-7 text-muted-foreground hover:text-foreground transition cursor-pointer"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Confirm password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex w-10 items-center justify-center pointer-events-none">
                      <Lock className="size-4 text-muted-foreground/70" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="no-native-reveal w-full pl-10 pr-3.5 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="press-scale w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/15 hover:shadow-blue-600/25 transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    'Reset password'
                  )}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              Back to login
            </button>
          </>
        )}
      </div>
    </div>
  )
}
