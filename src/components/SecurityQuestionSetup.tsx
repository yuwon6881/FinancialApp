import { Input } from './ui/Input'
import React, { useState, useEffect } from 'react'
import { ShieldCheck } from 'lucide-react'
import * as api from '../lib/api'
import { CustomSelect } from './ui/CustomSelect'
import { AlertBanner } from './ui/AlertBanner'
import { AuthCard, AuthHeader, AuthLoadingState, AuthShell } from './ui/AuthLayout'
import { Button } from './ui/Button'
import { FormField } from './ui/FormField'
import { focusFirstInvalidField } from './ui/formValidation'

interface SecurityQuestionSetupProps {
  onComplete: () => void
}

export const SecurityQuestionSetup: React.FC<SecurityQuestionSetupProps> = ({ onComplete }) => {
  const [availableQuestions, setAvailableQuestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [q1, setQ1] = useState<number>(-1)
  const [q2, setQ2] = useState<number>(-1)
  const [q3, setQ3] = useState<number>(-1)

  const [a1, setA1] = useState('')
  const [a2, setA2] = useState('')
  const [a3, setA3] = useState('')

  useEffect(() => {
    api.getAvailableSecurityQuestions()
      .then(q => setAvailableQuestions(q))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load questions'))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const nextErrors: Record<string, string> = {}
    const questions = [q1, q2, q3]
    const answers = [a1, a2, a3]
    questions.forEach((question, index) => {
      if (question === -1) nextErrors[`q${index + 1}`] = `Question ${index + 1} is required.`
    })
    questions.forEach((question, index) => {
      if (question !== -1 && questions.filter(candidate => candidate === question).length > 1) {
        nextErrors[`q${index + 1}`] = 'Choose a different security question.'
      }
    })
    answers.forEach((answer, index) => {
      if (!answer.trim()) nextErrors[`a${index + 1}`] = `Answer ${index + 1} is required.`
    })
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      focusFirstInvalidField(e.currentTarget)
      return
    }
    setFieldErrors({})

    setSubmitting(true)
    try {
      await api.setupSecurityQuestions([
        { questionId: q1, answer: a1 },
        { questionId: q2, answer: a2 },
        { questionId: q3, answer: a3 },
      ])
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setSubmitting(false)
    }
  }

  if (loading) {
    return <AuthLoadingState label="Loading security questions…" />
  }

  const rows = [
    { id: 'q1', val: q1, setVal: setQ1, ans: a1, setAns: setA1 },
    { id: 'q2', val: q2, setVal: setQ2, ans: a2, setAns: setA2 },
    { id: 'q3', val: q3, setVal: setQ3, ans: a3, setAns: setA3 },
  ]

  return (
    <AuthShell>
      <AuthCard>
        <AuthHeader
          icon={<span className="flex size-12 items-center justify-center rounded-2xl bg-blue-500/10"><ShieldCheck className="size-6 text-blue-500" /></span>}
          title="Secure your account"
          description="Pick three questions only you can answer. We use them to verify your identity during account recovery."
        />

        {error && (
          <AlertBanner variant="error">{error}</AlertBanner>
        )}

        <form noValidate onSubmit={handleSubmit} className="space-y-5">
          {rows.map((item, idx) => {
            const chosenElsewhere = rows.filter(r => r.id !== item.id).map(r => r.val)
            const options = [
              { value: -1, label: 'Select a question…' },
              ...availableQuestions
                .map((q, i) => ({ value: i, label: q }))
                .filter(opt => !chosenElsewhere.includes(opt.value)),
            ]
            return (
              <div key={item.id} className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span className="flex size-5 items-center justify-center rounded-md bg-blue-500/10 text-[10px] font-black text-blue-500">
                    {idx + 1}
                  </span>
                  Question {idx + 1}
                </div>
                <FormField
                  label={`Security question ${idx + 1}`}
                  required
                  error={fieldErrors[`q${idx + 1}`]}
                  labelClassName="sr-only"
                >
                  <CustomSelect<number>
                    ariaLabel={`Security question ${idx + 1}`}
                    value={item.val}
                    onChange={next => {
                      item.setVal(next)
                      const key = `q${idx + 1}`
                      if (fieldErrors[key]) setFieldErrors(previous => ({ ...previous, [key]: '' }))
                    }}
                    options={options}
                    className="w-full"
                  />
                </FormField>
                <FormField
                  label={`Answer ${idx + 1}`}
                  required
                  error={fieldErrors[`a${idx + 1}`]}
                  labelClassName="sr-only"
                >
                  <Input
                    type="text"
                    value={item.ans}
                    maxLength={256}
                    onChange={e => {
                      item.setAns(e.target.value)
                      const key = `a${idx + 1}`
                      if (fieldErrors[key]) setFieldErrors(previous => ({ ...previous, [key]: '' }))
                    }}
                    placeholder="Your answer"
                    autoComplete="off"
                  />
                </FormField>
              </div>
            )
          })}

          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="w-full rounded-xl py-3 shadow-lg shadow-primary/15"
          >
            {submitting ? (
              <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            ) : (
              'Save & Continue'
            )}
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  )
}
