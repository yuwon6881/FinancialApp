import React, { useState } from 'react'
import { ShieldCheck, User, Loader2, KeyRound } from 'lucide-react'
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] p-4 text-[var(--fg)]">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl lg:p-8">
        
        {success ? (
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 rounded-full bg-green-100 p-3 text-green-600 dark:bg-green-900/30 dark:text-green-500">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Password Reset Successful</h1>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">
              Your password has been successfully updated. You can now log in with your new password.
            </p>
            <button
              onClick={onBackToLogin}
              className="mt-6 flex w-full justify-center rounded-md bg-[var(--p)] py-2.5 font-medium text-white hover:bg-[var(--p-hover)]"
            >
              Return to Login
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-4 rounded-full bg-[var(--p-light)] p-3 text-[var(--p)]">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Account Recovery</h1>
              <p className="mt-2 text-sm text-[var(--fg-muted)]">
                {step === 1 && "Enter your username to begin."}
                {step === 2 && "Answer your security questions."}
                {step === 3 && "Create a new password."}
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-md bg-[var(--destructive-light)] p-3 text-sm text-[var(--destructive)]">
                {error}
              </div>
            )}

            {step === 1 && (
              <form onSubmit={handleStart} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] py-2.5 pl-10 pr-3 text-sm focus:border-[var(--p)] focus:outline-none focus:ring-1 focus:ring-[var(--p)]"
                      placeholder="Enter your username"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full justify-center rounded-md bg-[var(--p)] py-2.5 font-medium text-white hover:bg-[var(--p-hover)] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continue'}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleVerify} className="space-y-4">
                {[
                  { q: questions[0].question, a: a1, setA: setA1 },
                  { q: questions[1].question, a: a2, setA: setA2 },
                  { q: questions[2].question, a: a3, setA: setA3 },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <label className="text-sm font-medium">{item.q}</label>
                    <input
                      type="text"
                      value={item.a}
                      onChange={(e) => item.setA(e.target.value)}
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] p-2.5 text-sm focus:border-[var(--p)] focus:outline-none focus:ring-1 focus:ring-[var(--p)]"
                      placeholder="Your answer"
                      required
                      autoFocus={idx === 0}
                    />
                  </div>
                ))}
                <button
                  type="submit"
                  className="mt-2 flex w-full justify-center rounded-md bg-[var(--p)] py-2.5 font-medium text-white hover:bg-[var(--p-hover)]"
                >
                  Verify Answers
                </button>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">New Password</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] py-2.5 pl-10 pr-3 text-sm focus:border-[var(--p)] focus:outline-none focus:ring-1 focus:ring-[var(--p)]"
                      placeholder="Enter new password"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Confirm Password</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] py-2.5 pl-10 pr-3 text-sm focus:border-[var(--p)] focus:outline-none focus:ring-1 focus:ring-[var(--p)]"
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full justify-center rounded-md bg-[var(--p)] py-2.5 font-medium text-white hover:bg-[var(--p-hover)] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Reset Password'}
                </button>
              </form>
            )}

            <div className="mt-6 text-center">
              <button
                onClick={onBackToLogin}
                className="text-sm font-medium text-[var(--p)] hover:underline"
              >
                Back to Login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
