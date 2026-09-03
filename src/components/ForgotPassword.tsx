import { Input } from './ui/Input'
import React, { useState } from 'react'
import { User, Lock, Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react'
import * as api from '../lib/api'
import type { SecurityQuestion } from '../types'
import { AlertBanner } from './ui/AlertBanner'
import { AuthCard, AuthHeader, AuthShell } from './ui/AuthLayout'
import { Button } from './ui/Button'
import { FormField } from './ui/FormField'
import { focusFirstInvalidField } from './ui/formValidation'
import { getNewPasswordError } from '../lib/passwordPolicy'

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState(false)

  const handleStart = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!username.trim()) {
      setFieldErrors({ username: 'Username is required.' })
      focusFirstInvalidField(e.currentTarget)
      return
    }
    setFieldErrors({})

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

  const handleVerify = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const nextErrors: Record<string, string> = {}
    if (!a1.trim()) nextErrors.answer1 = 'Answer 1 is required.'
    if (!a2.trim()) nextErrors.answer2 = 'Answer 2 is required.'
    if (!a3.trim()) nextErrors.answer3 = 'Answer 3 is required.'
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      focusFirstInvalidField(e.currentTarget)
      return
    }
    setFieldErrors({})
    setStep(3)
  }

  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const nextErrors: Record<string, string> = {}
    const passwordError = getNewPasswordError(newPassword)
    if (passwordError) nextErrors.newPassword = passwordError.replace('Password is', 'New password is')
    if (!confirmPassword) nextErrors.confirmPassword = 'Confirm password is required.'
    else if (newPassword !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.'
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      focusFirstInvalidField(e.currentTarget)
      return
    }
    setFieldErrors({})

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
    <AuthShell>
      <AuthCard>

        {success ? (
          <div className="flex flex-col items-center text-center space-y-4 select-none">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10">
              <CheckCircle2 className="size-6 text-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-black tracking-tight text-foreground">Password reset</h1>
              <p className="text-xs text-muted-foreground">
                Your password has been updated and all other sessions were signed out. You can now log
                in with your new password.
              </p>
            </div>
            <Button
              onClick={onBackToLogin}
              size="lg"
              className="w-full rounded-xl py-3 shadow-lg shadow-primary/15"
            >
              Return to login
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <AuthHeader
              icon={<span className="flex size-12 items-center justify-center rounded-2xl bg-blue-500/10"><KeyRound className="size-6 text-blue-500" /></span>}
              title="Account recovery"
              description={
                step === 1 ? 'Enter your username to begin.'
                  : step === 2 ? 'Answer your security questions to verify it’s you.'
                    : 'Create a new password for your account.'
              }
            />

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
              <AlertBanner variant="error">{error}</AlertBanner>
            )}

            {step === 1 && (
              <form noValidate onSubmit={handleStart} className="space-y-4">
                <FormField
                  label="Username"
                  required
                  error={fieldErrors.username}
                  labelClassName="uppercase tracking-wider"
                >
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex w-10 items-center justify-center pointer-events-none">
                      <User className="size-4 text-muted-foreground/70" />
                    </span>
                    <Input
                      type="text"
                      value={username}
                      onChange={e => {
                        setUsername(e.target.value)
                        if (fieldErrors.username) setFieldErrors(previous => ({ ...previous, username: '' }))
                      }}
                      className="pl-10"
                      placeholder="Enter your username"
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                </FormField>
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full rounded-xl py-3 shadow-lg shadow-primary/15"
                >
                  {loading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  ) : (
                    'Continue'
                  )}
                </Button>
              </form>
            )}

            {step === 2 && (
              <form noValidate onSubmit={handleVerify} className="space-y-4">
                {[
                  { q: questions[0]?.question, a: a1, setA: setA1 },
                  { q: questions[1]?.question, a: a2, setA: setA2 },
                  { q: questions[2]?.question, a: a3, setA: setA3 },
                ].map((item, idx) => (
                  <FormField
                    key={idx}
                    label={item.q}
                    required
                    error={fieldErrors[`answer${idx + 1}`]}
                    labelClassName="leading-snug text-foreground"
                  >
                    <Input
                      type="text"
                      value={item.a}
                      maxLength={256}
                      onChange={e => {
                        item.setA(e.target.value)
                        const key = `answer${idx + 1}`
                        if (fieldErrors[key]) setFieldErrors(previous => ({ ...previous, [key]: '' }))
                      }}
                      placeholder="Your answer"
                      autoComplete="off"
                      autoFocus={idx === 0}
                    />
                  </FormField>
                ))}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full rounded-xl py-3 shadow-lg shadow-primary/15"
                >
                  Verify answers
                </Button>
              </form>
            )}

            {step === 3 && (
              <form noValidate onSubmit={handleReset} className="space-y-4">
                <FormField
                  label="New password"
                  required
                  error={fieldErrors.newPassword}
                  labelClassName="uppercase tracking-wider"
                >
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex w-10 items-center justify-center pointer-events-none">
                      <Lock className="size-4 text-muted-foreground/70" />
                    </span>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => {
                        setNewPassword(e.target.value)
                        if (fieldErrors.newPassword) setFieldErrors(previous => ({ ...previous, newPassword: '' }))
                      }}
                      className="no-native-reveal pl-10 pr-10"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      autoFocus
                    />
                    {newPassword.length > 0 && (
                      <Button
                        type="button"
                        variant="tertiary"
                        size="icon"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                    )}
                  </div>
                </FormField>
                <FormField
                  label="Confirm password"
                  required
                  error={fieldErrors.confirmPassword}
                  labelClassName="uppercase tracking-wider"
                >
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex w-10 items-center justify-center pointer-events-none">
                      <Lock className="size-4 text-muted-foreground/70" />
                    </span>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => {
                        setConfirmPassword(e.target.value)
                        if (fieldErrors.confirmPassword) setFieldErrors(previous => ({ ...previous, confirmPassword: '' }))
                      }}
                      className="no-native-reveal pl-10"
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                  </div>
                </FormField>
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full rounded-xl py-3 shadow-lg shadow-primary/15"
                >
                  {loading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  ) : (
                    'Reset password'
                  )}
                </Button>
              </form>
            )}

            <Button
              type="button"
              variant="tertiary"
              onClick={onBackToLogin}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              Back to login
            </Button>
          </>
        )}
      </AuthCard>
    </AuthShell>
  )
}
