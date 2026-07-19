import React, { useState, useEffect } from 'react'
import { ShieldCheck, Loader2 } from 'lucide-react'
import * as api from '../lib/api'

interface SecurityQuestionSetupProps {
  onComplete: () => void
}

export const SecurityQuestionSetup: React.FC<SecurityQuestionSetupProps> = ({ onComplete }) => {
  const [availableQuestions, setAvailableQuestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (q1 === -1 || q2 === -1 || q3 === -1) {
      setError('Please select three questions.')
      return
    }

    if (new Set([q1, q2, q3]).size !== 3) {
      setError('Please select three distinct questions.')
      return
    }

    if (!a1.trim() || !a2.trim() || !a3.trim()) {
      setError('Answers cannot be empty.')
      return
    }

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
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)] text-[var(--fg)]">
        <Loader2 className="h-8 w-8 animate-spin opacity-50" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] p-4 text-[var(--fg)]">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl lg:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 rounded-full bg-[var(--p-light)] p-3 text-[var(--p)]">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Security Setup Required</h1>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            Please set up security questions to enable self-service password recovery in the future.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-[var(--destructive-light)] p-3 text-sm text-[var(--destructive)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {[
            { id: 'q1', val: q1, setVal: setQ1, ans: a1, setAns: setA1, label: 'Question 1' },
            { id: 'q2', val: q2, setVal: setQ2, ans: a2, setAns: setA2, label: 'Question 2' },
            { id: 'q3', val: q3, setVal: setQ3, ans: a3, setAns: setA3, label: 'Question 3' },
          ].map(item => (
            <div key={item.id} className="space-y-2">
              <label className="text-sm font-medium">{item.label}</label>
              <select
                value={item.val}
                onChange={e => item.setVal(Number(e.target.value))}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] p-2.5 text-sm focus:border-[var(--p)] focus:outline-none focus:ring-1 focus:ring-[var(--p)]"
                required
              >
                <option value={-1} disabled>Select a question...</option>
                {availableQuestions.map((q, i) => (
                  <option key={i} value={i} disabled={[q1, q2, q3].includes(i) && item.val !== i}>
                    {q}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={item.ans}
                onChange={e => item.setAns(e.target.value)}
                placeholder="Your answer"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] p-2.5 text-sm focus:border-[var(--p)] focus:outline-none focus:ring-1 focus:ring-[var(--p)]"
                required
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 flex w-full items-center justify-center rounded-md bg-[var(--p)] py-2.5 font-medium text-white hover:bg-[var(--p-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--p)] focus:ring-offset-2 focus:ring-offset-[var(--bg)] disabled:opacity-50 transition-colors"
          >
            {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Save & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
